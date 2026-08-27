import os
import hashlib
import json
import httpx
import re
import urllib.parse
from typing import List, Dict, Any
from datetime import datetime, timezone
from app.config import settings

def generate_job_fingerprint(title: str, company: str, location: str = "") -> str:
    """Generate SHA256 hash for job deduplication."""
    norm_title = re.sub(r"\W+", "", title.lower())
    norm_company = re.sub(r"\W+", "", company.lower())
    norm_loc = re.sub(r"\W+", "", (location or "").lower())
    raw = f"{norm_title}:{norm_company}:{norm_loc}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

class JobDiscoveryEngine:
    """
    Tiered job discovery engine:
    Tier 1 (Free APIs): Remotive, Arbeitnow, Adzuna (free tier)
    Tier 2 (User API keys): JSearch via RapidAPI, custom endpoints
    Tier 3 (Fallback Scraper): Light web scraper for public boards
    """

    def __init__(self, user_api_keys: Dict[str, str] = None):
        self.user_api_keys = user_api_keys or {}

    async def fetch_remotive_jobs(self, search_query: str = "") -> List[Dict[str, Any]]:
        """Tier 1: Remotive Public API (Remote tech jobs, no auth required)."""
        jobs = []
        try:
            url = f"https://remotive.com/api/remote-jobs?search={search_query}" if search_query else "https://remotive.com/api/remote-jobs?limit=25"
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    for item in data.get("jobs", []):
                        title = item.get("title", "")
                        company = item.get("company_name", "")
                        location = item.get("candidate_required_location", "Remote")
                        fingerprint = generate_job_fingerprint(title, company, location)
                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": location,
                            "employment_type": item.get("job_type", "Full-Time"),
                            "salary_min": None,
                            "salary_max": None,
                            "description": item.get("description", ""),
                            "required_skills": item.get("tags", []),
                            "application_url": item.get("url", ""),
                            "source_platform": "remotive",
                            "posted_date": item.get("publication_date", ""),
                            "fingerprint": fingerprint
                        })
        except Exception as e:
            print(f"[WARN] Remotive API failed: {e}")
        return jobs

    async def fetch_arbeitnow_jobs(self, search_query: str = "") -> List[Dict[str, Any]]:
        """Tier 1: Arbeitnow Free Public API."""
        jobs = []
        try:
            url = "https://www.arbeitnow.com/api/job-board-api"
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    for item in data.get("data", []):
                        title = item.get("title", "")
                        company = item.get("company_name", "")
                        location = item.get("location", "Remote")
                        
                        if search_query and search_query.lower() not in title.lower() and search_query.lower() not in item.get("description", "").lower():
                            continue

                        fingerprint = generate_job_fingerprint(title, company, location)
                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": location,
                            "employment_type": "Full-Time" if not item.get("remote") else "Remote",
                            "salary_min": None,
                            "salary_max": None,
                            "description": item.get("description", ""),
                            "required_skills": item.get("tags", []),
                            "application_url": item.get("url", ""),
                            "source_platform": "arbeitnow",
                            "posted_date": str(item.get("created_at", "")),
                            "fingerprint": fingerprint
                        })
        except Exception as e:
            print(f"[WARN] Arbeitnow API failed: {e}")
        return jobs

    async def fetch_jsearch_jobs(self, query: str, location: str = "") -> List[Dict[str, Any]]:
        """Tier 2: JSearch API via RapidAPI (Aggregates Indeed, LinkedIn, Glassdoor, ZipRecruiter)."""
        rapidapi_key = (
            self.user_api_keys.get("rapidapi_key") or
            self.user_api_keys.get("jsearch_key") or
            getattr(settings, "RAPIDAPI_KEY", None) or
            os.environ.get("RAPIDAPI_KEY")
        )
        if not rapidapi_key:
            return []

        jobs = []
        try:
            url = "https://jsearch.p.rapidapi.com/search-v2"
            headers = {
                "X-RapidAPI-Key": rapidapi_key,
                "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
            }
            params = {"query": f"{query} in {location}".strip(), "num_pages": "1"}
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(url, headers=headers, params=params)
                if res.status_code != 200:
                    res = await client.get("https://jsearch.p.rapidapi.com/search", headers=headers, params=params)

                if res.status_code == 200:
                    raw_json = res.json()
                    raw_data = raw_json.get("data", [])
                    items = raw_data.get("jobs", []) if isinstance(raw_data, dict) else (raw_data if isinstance(raw_data, list) else [])
                    for item in items:
                        title = item.get("job_title", "")
                        company = item.get("employer_name", "")
                        loc = f"{item.get('job_city', '')}, {item.get('job_country', '')}".strip(", ")
                        fingerprint = generate_job_fingerprint(title, company, loc)
                        
                        pub_lower = (item.get("job_publisher") or "").lower()
                        if "indeed" in pub_lower:
                            source = "indeed"
                        elif "foundit" in pub_lower or "monster" in pub_lower:
                            source = "foundit"
                        elif "linkedin" in pub_lower:
                            source = "linkedin"
                        elif "glassdoor" in pub_lower:
                            source = "glassdoor"
                        elif "ziprecruiter" in pub_lower:
                            source = "ziprecruiter"
                        else:
                            source = "indeed"  # Default generic aggregator postings to indeed

                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": loc or "Remote",
                            "employment_type": item.get("job_employment_type", "Full-Time"),
                            "salary_min": item.get("job_min_salary"),
                            "salary_max": item.get("job_max_salary"),
                            "description": item.get("job_description", ""),
                            "required_skills": item.get("job_required_skills") or [],
                            "application_url": item.get("job_apply_link") or item.get("job_google_link", ""),
                            "source_platform": source,
                            "posted_date": item.get("job_posted_at_datetime_utc", ""),
                            "fingerprint": fingerprint
                        })
        except Exception as e:
            print(f"[WARN] JSearch API failed: {e}")
        return jobs

    async def fetch_indeed_jobs(self, query: str, location: str = "") -> List[Dict[str, Any]]:
        """Fetch targeted Indeed job postings via RapidAPI JSearch."""
        rapidapi_key = (
            self.user_api_keys.get("rapidapi_key") or
            self.user_api_keys.get("jsearch_key") or
            getattr(settings, "RAPIDAPI_KEY", None) or
            os.environ.get("RAPIDAPI_KEY")
        )
        if not rapidapi_key:
            return []

        jobs = []
        try:
            url = "https://jsearch.p.rapidapi.com/search-v2"
            headers = {
                "X-RapidAPI-Key": rapidapi_key,
                "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
            }
            params = {"query": f"{query} on Indeed in {location}".strip(), "num_pages": "1"}
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(url, headers=headers, params=params)
                if res.status_code == 200:
                    raw_data = res.json().get("data", {})
                    items = raw_data.get("jobs", []) if isinstance(raw_data, dict) else (raw_data if isinstance(raw_data, list) else [])
                    for item in items:
                        title = item.get("job_title", "")
                        company = item.get("employer_name", "")
                        loc = f"{item.get('job_city', '')}, {item.get('job_country', '')}".strip(", ")
                        fingerprint = generate_job_fingerprint(title, company, loc)
                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": loc or "Remote",
                            "employment_type": item.get("job_employment_type", "Full-Time"),
                            "salary_min": item.get("job_min_salary"),
                            "salary_max": item.get("job_max_salary"),
                            "description": item.get("job_description", ""),
                            "required_skills": item.get("job_required_skills") or [],
                            "application_url": item.get("job_apply_link") or item.get("job_google_link", ""),
                            "source_platform": "indeed",
                            "posted_date": item.get("job_posted_at_datetime_utc", ""),
                            "fingerprint": fingerprint
                        })
        except Exception as e:
            print(f"[WARN] Indeed fetch failed: {e}")
        return jobs

    async def fetch_foundit_jobs(self, query: str, location: str = "") -> List[Dict[str, Any]]:
        """Fetch targeted Foundit (Monster) job postings via RapidAPI JSearch."""
        rapidapi_key = (
            self.user_api_keys.get("rapidapi_key") or
            self.user_api_keys.get("jsearch_key") or
            getattr(settings, "RAPIDAPI_KEY", None) or
            os.environ.get("RAPIDAPI_KEY")
        )
        if not rapidapi_key:
            return []

        jobs = []
        try:
            url = "https://jsearch.p.rapidapi.com/search-v2"
            headers = {
                "X-RapidAPI-Key": rapidapi_key,
                "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
            }
            params = {"query": f"{query} on Foundit in {location}".strip(), "num_pages": "1"}
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(url, headers=headers, params=params)
                if res.status_code == 200:
                    raw_data = res.json().get("data", {})
                    items = raw_data.get("jobs", []) if isinstance(raw_data, dict) else (raw_data if isinstance(raw_data, list) else [])
                    for item in items:
                        title = item.get("job_title", "")
                        company = item.get("employer_name", "")
                        loc = f"{item.get('job_city', '')}, {item.get('job_country', '')}".strip(", ")
                        fingerprint = generate_job_fingerprint(title, company, loc)
                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": loc or "Remote",
                            "employment_type": item.get("job_employment_type", "Full-Time"),
                            "salary_min": item.get("job_min_salary"),
                            "salary_max": item.get("job_max_salary"),
                            "description": item.get("job_description", ""),
                            "required_skills": item.get("job_required_skills") or [],
                            "application_url": item.get("job_apply_link") or item.get("job_google_link", ""),
                            "source_platform": "foundit",
                            "posted_date": item.get("job_posted_at_datetime_utc", ""),
                            "fingerprint": fingerprint
                        })
        except Exception as e:
            print(f"[WARN] Foundit fetch failed: {e}")
        return jobs

    async def fetch_jobicy_jobs(self, search_query: str = "") -> List[Dict[str, Any]]:
        """Tier 1: Jobicy Free Remote Jobs API."""
        jobs = []
        try:
            url = f"https://jobicy.com/api/v2/remote-jobs?count=30&industry=engineering"
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    for item in data.get("jobs", []):
                        title = item.get("jobTitle", "")
                        company = item.get("companyName", "")
                        location = item.get("jobGeo", "Remote")
                        
                        if search_query and search_query.lower() not in title.lower() and search_query.lower() not in item.get("jobDescription", "").lower():
                            continue

                        fingerprint = generate_job_fingerprint(title, company, location)
                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": location,
                            "employment_type": item.get("jobType", ["Full-Time"])[0] if isinstance(item.get("jobType"), list) else "Full-Time",
                            "salary_min": item.get("annualSalaryMin"),
                            "salary_max": item.get("annualSalaryMax"),
                            "description": item.get("jobDescription", ""),
                            "required_skills": [],
                            "application_url": item.get("url", ""),
                            "source_platform": "jobicy",
                            "posted_date": item.get("pubDate", ""),
                            "fingerprint": fingerprint
                        })
        except Exception as e:
            print(f"[WARN] Jobicy API failed: {e}")
        return jobs

    async def fetch_linkedin_guest_jobs(self, search_query: str = "", location: str = "Bengaluru") -> List[Dict[str, Any]]:
        """Tier 1: LinkedIn Public Guest Search API (Direct live job listings for India / Bengaluru, no auth needed)."""
        jobs = []
        loc_str = location if location else "Bengaluru"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
        encoded_query = urllib.parse.quote(search_query or "Software Engineer")
        encoded_loc = urllib.parse.quote(f"{loc_str}, Karnataka, India" if "india" not in loc_str.lower() else loc_str)

        async with httpx.AsyncClient(timeout=12.0) as client:
            for start in (0, 25, 50, 75, 100):
                try:
                    url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={encoded_query}&location={encoded_loc}&start={start}"
                    res = await client.get(url, headers=headers, follow_redirects=True)
                    if res.status_code == 200:
                        html = res.text
                        titles = re.findall(r'class="base-search-card__title"[^>]*>\s*([^<]+)\s*<', html)
                        companies = (
                            re.findall(r'class="base-search-card__subtitle"[^>]*>\s*<a[^>]*>\s*([^<]+)\s*<', html) or
                            re.findall(r'class="base-search-card__subtitle"[^>]*>\s*([^<]+)\s*<', html)
                        )
                        locations = re.findall(r'class="job-search-card__location"[^>]*>\s*([^<]+)\s*<', html)
                        links = (
                            re.findall(r'href="(https://[^"]*linkedin\.com/jobs/view/[^"]*)"', html) or
                            re.findall(r'class="base-card__full-link"[^>]*href="([^"]+)"', html)
                        )
                        dates = re.findall(r'<time[^>]*datetime="([^"]+)"', html)

                        for i in range(len(titles)):
                            t = titles[i].strip()
                            c = companies[i].strip() if i < len(companies) else "Company"
                            l = locations[i].strip() if i < len(locations) else f"{loc_str}, India"
                            link = links[i].split("?")[0] if i < len(links) else f"https://www.linkedin.com/jobs/search?keywords={encoded_query}"
                            d = dates[i] if i < len(dates) else datetime.now(timezone.utc).strftime("%Y-%m-%d")

                            fingerprint = generate_job_fingerprint(t, c, l)
                            jobs.append({
                                "title": t,
                                "company": c,
                                "location": l,
                                "employment_type": "Full-Time",
                                "salary_min": None,
                                "salary_max": None,
                                "description": f"{t} position at {c} in {l}. Direct link to apply on LinkedIn.",
                                "required_skills": [search_query] if search_query else [],
                                "application_url": link,
                                "source_platform": "linkedin",
                                "posted_date": d,
                                "fingerprint": fingerprint
                            })
                except Exception as e:
                    print(f"[WARN] LinkedIn Guest API start={start} failed: {e}")
        return jobs

    @staticmethod
    def _parse_date(date_str: Any) -> float:
        """Parse various date representation formats into Unix timestamp for sorting."""
        if not date_str:
            return 0.0
        if isinstance(date_str, (int, float)):
            return float(date_str)
        try:
            s = str(date_str).strip()
            # Try ISO / Standard formats
            for fmt in (
                "%Y-%m-%dT%H:%M:%S%z",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
                "%a, %d %b %Y %H:%M:%S %z",
                "%a, %d %b %Y %H:%M:%S GMT"
            ):
                try:
                    dt = datetime.strptime(s, fmt)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    return dt.timestamp()
                except ValueError:
                    continue
        except Exception:
            pass
        return 0.0

    async def fetch_unstop_jobs(self, search_query: str = "", location: str = "Bengaluru") -> List[Dict[str, Any]]:
        """Unstop India Job Search Scraper (Jobs in India / target location, no auth required)."""
        jobs = []
        encoded_q = urllib.parse.quote(search_query or "Software Engineer")
        url = f"https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&searchTerm={encoded_q}&per_page=15"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*"
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=headers, follow_redirects=True)
                if res.status_code == 200:
                    data = res.json()
                    items = data.get("data", {}).get("data", [])
                    for item in items:
                        title = item.get("title")
                        company = item.get("organisation", {}).get("name", "Tech Company")
                        public_slug = item.get("public_url")
                        if not title or not public_slug:
                            continue

                        app_url = f"https://unstop.com/{public_slug}" if not public_slug.startswith("http") else public_slug

                        loc_objs = item.get("locations", [])
                        loc_names = [l.get("city", "") for l in loc_objs if isinstance(l, dict) and l.get("city")]
                        job_loc = ", ".join(loc_names) if loc_names else location

                        fingerprint = generate_job_fingerprint(title, company, job_loc)
                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": job_loc,
                            "employment_type": "Full-Time",
                            "salary_min": None,
                            "salary_max": None,
                            "description": f"{title} opportunity at {company} in {job_loc}. Direct link on Unstop.",
                            "required_skills": [search_query] if search_query else [],
                            "application_url": app_url,
                            "source_platform": "unstop",
                            "posted_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                            "fingerprint": fingerprint
                        })
        except Exception as e:
            print(f"[WARN] Unstop scraper failed: {e}")
        return jobs

    async def fetch_instahyre_jobs(self, search_query: str = "", location: str = "Bengaluru") -> List[Dict[str, Any]]:
        """Instahyre India Tech Job Scraper (Live startup & product jobs, no auth required)."""
        jobs = []
        encoded_q = urllib.parse.quote(search_query or "Software Engineer")
        encoded_loc = urllib.parse.quote(location if location else "Bangalore")
        url = f"https://www.instahyre.com/api/v1/job_search?designation={encoded_q}&city={encoded_loc}&count=25"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*"
        }
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(url, headers=headers, follow_redirects=True)
                if res.status_code == 200:
                    data = res.json()
                    for item in data.get("objects", []):
                        title = item.get("title") or item.get("candidate_title")
                        company = item.get("employer", {}).get("company_name", "Tech Startup")
                        if not title:
                            continue

                        loc_list = item.get("locations", [])
                        loc_str = ", ".join(loc_list) if isinstance(loc_list, list) and loc_list else location
                        app_url = item.get("public_url") or f"https://www.instahyre.com/job-{item.get('id', '')}"

                        raw_keywords = item.get("keywords") or []
                        skills = raw_keywords if isinstance(raw_keywords, list) else [search_query]

                        fingerprint = generate_job_fingerprint(title, company, loc_str)
                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": loc_str,
                            "employment_type": "Full-Time",
                            "salary_min": None,
                            "salary_max": None,
                            "description": f"{title} role at {company} in {loc_str}. Required skills: {', '.join(skills[:5])}. Direct application via Instahyre.",
                            "required_skills": skills,
                            "application_url": app_url,
                            "source_platform": "instahyre",
                            "posted_date": item.get("reviewed_at") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                            "fingerprint": fingerprint
                        })
        except Exception as e:
            print(f"[WARN] Instahyre scraper failed: {e}")
        return jobs

    async def fetch_wellfound_jobs(self, search_query: str = "", location: str = "Bengaluru") -> List[Dict[str, Any]]:
        """Wellfound (AngelList) Startup Job Scraper (Live startup roles in India & Remote)."""
        jobs = []
        slug = re.sub(r"[^a-zA-Z0-9]+", "-", (search_query or "software-engineer").lower()).strip("-")
        loc_slug = "bengaluru-bangalore" if "bengaluru" in location.lower() or "bangalore" in location.lower() else "india"
        url = f"https://wellfound.com/role/l/{slug}/{loc_slug}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(url, headers=headers, follow_redirects=True)
                if res.status_code == 200:
                    job_pattern = re.findall(r'href="(/jobs/(\d+)-([^"]+))"[^>]*>([^<]+)</a>', res.text)
                    for full_path, job_id, job_slug, link_text in job_pattern[:20]:
                        title = link_text.strip() or job_slug.replace("-", " ").title()
                        app_url = f"https://wellfound.com{full_path}"
                        company = "YC / Venture-Backed Startup"
                        # Try finding company from link or text
                        m_comp = re.search(rf'href="(/company/[^"]+)"[^>]*>([^<]+)</a>', res.text)
                        if m_comp:
                            company = m_comp.group(2).strip()

                        fingerprint = generate_job_fingerprint(title, company, location)
                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": location,
                            "employment_type": "Full-Time",
                            "salary_min": None,
                            "salary_max": None,
                            "description": f"{title} startup position at {company} in {location}. Direct link on Wellfound.",
                            "required_skills": [search_query] if search_query else ["Startups", "Software Engineering"],
                            "application_url": app_url,
                            "source_platform": "wellfound",
                            "posted_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                            "fingerprint": fingerprint
                        })
        except Exception as e:
            print(f"[WARN] Wellfound scraper failed: {e}")
        return jobs

    async def fetch_remoteok_jobs(self, search_query: str = "") -> List[Dict[str, Any]]:
        """RemoteOK Free Public API (Global remote tech jobs)."""
        jobs = []
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        try:
            url = "https://remoteok.com/api"
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    for item in data[1:35]: # Skip disclaimer header object
                        if not isinstance(item, dict):
                            continue
                        title = item.get("position", "")
                        company = item.get("company", "")
                        location = item.get("location", "Remote")
                        if search_query and search_query.lower() not in title.lower() and search_query.lower() not in item.get("description", "").lower():
                            continue

                        fingerprint = generate_job_fingerprint(title, company, location)
                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": location or "Remote",
                            "employment_type": "Full-Time",
                            "salary_min": item.get("salary_min"),
                            "salary_max": item.get("salary_max"),
                            "description": item.get("description", ""),
                            "required_skills": item.get("tags", []),
                            "application_url": item.get("url", ""),
                            "source_platform": "remoteok",
                            "posted_date": str(item.get("date", "")),
                            "fingerprint": fingerprint
                        })
        except Exception as e:
            print(f"[WARN] RemoteOK API failed: {e}")
        return jobs

    async def discover_jobs(self, job_titles: List[str], locations: List[str] = None) -> List[Dict[str, Any]]:
        """Discover jobs from all available tiers, deduplicate, and sort NEWEST FIRST."""
        all_jobs = []
        fingerprints_seen = set()

        titles = job_titles if job_titles else ["Software Engineer"]
        target_locations = [loc.strip() for loc in (locations or ["Bengaluru"]) if loc and loc.strip()]
        if not target_locations:
            target_locations = ["Bengaluru"]

        for title in titles[:4]:
            for loc in target_locations:
                linkedin_jobs = await self.fetch_linkedin_guest_jobs(title, loc)
                indeed_jobs = await self.fetch_indeed_jobs(title, loc)
                foundit_jobs = await self.fetch_foundit_jobs(title, loc)
                instahyre_jobs = await self.fetch_instahyre_jobs(title, loc)
                wellfound_jobs = await self.fetch_wellfound_jobs(title, loc)
                unstop_jobs = await self.fetch_unstop_jobs(title, loc)
                remoteok_jobs = await self.fetch_remoteok_jobs(title)
                remotive_jobs = await self.fetch_remotive_jobs(title)
                arbeitnow_jobs = await self.fetch_arbeitnow_jobs(title)
                jobicy_jobs = await self.fetch_jobicy_jobs(title)
                jsearch_jobs = await self.fetch_jsearch_jobs(title, loc)

                for job_list in [linkedin_jobs, indeed_jobs, foundit_jobs, instahyre_jobs, wellfound_jobs, unstop_jobs, remoteok_jobs, remotive_jobs, arbeitnow_jobs, jobicy_jobs, jsearch_jobs]:
                    for j in job_list:
                        fp = j["fingerprint"]
                        if fp not in fingerprints_seen:
                            fingerprints_seen.add(fp)
                            all_jobs.append(j)

        # Sort aggregate collection: Newest first (highest timestamp to lowest)
        all_jobs.sort(key=lambda j: self._parse_date(j.get("posted_date")), reverse=True)

        return all_jobs

