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
    """Generate SHA256 hash for job deduplication based on title and company."""
    norm_title = re.sub(r"\W+", "", title.lower())
    norm_company = re.sub(r"\W+", "", company.lower())
    raw = f"{norm_title}:{norm_company}"
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
                        job_city = item.get("job_city") or ""
                        job_country = item.get("job_country") or ""
                        loc = f"{job_city}, {job_country}".strip(", ")
                        if not loc or loc.lower() in ["none, none", "none", "null, null"]:
                            loc = location or "Remote"
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
                elif res.status_code == 429:
                    print("[INFO] RapidAPI JSearch monthly quota exceeded (HTTP 429). Rotate or upgrade RapidAPI key in Settings to fetch live Indeed postings.")
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
                        job_city = item.get("job_city") or ""
                        job_country = item.get("job_country") or ""
                        loc = f"{job_city}, {job_country}".strip(", ")
                        if not loc or loc.lower() in ["none, none", "none", "null, null"]:
                            loc = location or "Remote"
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
                elif res.status_code == 429:
                    print("[INFO] RapidAPI JSearch monthly quota exceeded (HTTP 429). Rotate or upgrade RapidAPI key in Settings to fetch live Foundit postings.")
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
                            l = locations[i].strip() if i < len(locations) and locations[i].strip() else "Not Specified"
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
                        is_virtual = item.get("is_virtual") or item.get("job_type") == "virtual"
                        if loc_names:
                            job_loc = ", ".join(loc_names)
                        elif is_virtual:
                            job_loc = "Remote"
                        else:
                            job_loc = "Not Specified"

                        fingerprint = generate_job_fingerprint(title, company, job_loc)
                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": job_loc,
                            "employment_type": "Full-Time" if job_loc != "Remote" else "Remote",
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
        # Instahyre city filter (omit if searching for generic remote)
        city_param = "" if location.lower() in ["remote", "fully remote"] else location
        encoded_loc = urllib.parse.quote(city_param) if city_param else ""
        url = f"https://www.instahyre.com/api/v1/job_search?designation={encoded_q}&count=25"
        if encoded_loc:
            url += f"&city={encoded_loc}"

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
                        employer_data = item.get("employer") or {}
                        company = employer_data.get("company_name", "Tech Startup")
                        if not title:
                            continue

                        raw_loc = item.get("locations")
                        if isinstance(raw_loc, str) and raw_loc.strip():
                            # If Instahyre returns "Work From Home", normalize to "Remote"
                            loc_str = "Remote" if "work from home" in raw_loc.lower() else ", ".join([p.strip() for p in raw_loc.split(",") if p.strip()])
                        elif isinstance(raw_loc, list) and raw_loc:
                            loc_parts = []
                            for l in raw_loc:
                                if isinstance(l, dict):
                                    city = l.get("city") or l.get("name")
                                    if city:
                                        loc_parts.append(str(city))
                                elif isinstance(l, str) and l.strip():
                                    loc_parts.append(l.strip())
                            loc_str = ", ".join(loc_parts) if loc_parts else "Not Specified"
                        else:
                            loc_str = "Not Specified"

                        app_url = item.get("public_url") or f"https://www.instahyre.com/job-{item.get('id', '')}"
                        raw_keywords = item.get("keywords") or []
                        skills = raw_keywords if isinstance(raw_keywords, list) else [search_query]

                        note = employer_data.get("instahyre_note", "")
                        desc_parts = [f"{title} role at {company} in {loc_str}."]
                        if skills:
                            desc_parts.append(f"Required skills: {', '.join(skills[:8])}.")
                        if note:
                            desc_parts.append(note[:250])
                        desc_parts.append("Direct application via Instahyre.")
                        description = " ".join(desc_parts)

                        fingerprint = generate_job_fingerprint(title, company, loc_str)
                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": loc_str,
                            "employment_type": "Full-Time" if loc_str != "Remote" else "Remote",
                            "salary_min": None,
                            "salary_max": None,
                            "description": description,
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
        """Wellfound (AngelList) Startup Job Scraper with structured card and metadata parsing."""
        jobs = []
        seen_urls = set()
        base_slug = re.sub(r"[^a-zA-Z0-9]+", "-", (search_query or "software-engineer").lower()).strip("-")

        slugs = [base_slug]
        if any(k in base_slug for k in ["software", "developer", "backend", "fullstack", "full-stack"]):
            slugs.extend(["backend-engineer", "full-stack-engineer", "software-engineer"])
        elif any(k in base_slug for k in ["ai", "machine-learning", "data", "ml"]):
            slugs.extend(["ai-engineer", "machine-learning-engineer", "data-scientist"])

        loc_lower = location.lower().strip() if location else ""
        if "bengaluru" in loc_lower or "bangalore" in loc_lower:
            loc_slug = "bangalore"
        elif "delhi" in loc_lower or "noida" in loc_lower or "gurgaon" in loc_lower or "gurugram" in loc_lower:
            loc_slug = "delhi-ncr"
        elif "san francisco" in loc_lower or "sf" in loc_lower:
            loc_slug = "san-francisco"
        elif "new york" in loc_lower or "nyc" in loc_lower:
            loc_slug = "new-york-city"
        elif loc_lower and loc_lower not in ["remote", "fully remote", "worldwide", "anywhere"]:
            loc_slug = re.sub(r"[^a-zA-Z0-9]+", "-", loc_lower).strip("-")
        else:
            loc_slug = ""

        urls_to_try = []
        for s in list(dict.fromkeys(slugs)):
            if loc_slug:
                urls_to_try.append(f"https://wellfound.com/role/l/{s}/{loc_slug}")
                if "india" in loc_lower or loc_slug == "bangalore":
                    urls_to_try.append(f"https://wellfound.com/role/l/{s}/india")
            urls_to_try.append(f"https://wellfound.com/role/{s}")

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                successful_pages = 0
                for u in urls_to_try:
                    if successful_pages >= 3:
                        break
                    try:
                        r = await client.get(u, headers=headers, follow_redirects=True)
                        if r.status_code != 200 or len(r.text) < 5000:
                            continue
                        successful_pages += 1
                        html = r.text

                        # Divide HTML by startup-header sections to accurately associate companies
                        sections = html.split('data-testid="startup-header"')
                        
                        for sec in sections[1:]:
                            # 1. Company name for this startup block
                            m_comp = re.search(r'alt="([^"]+?)\s+company logo"', sec)
                            if not m_comp:
                                m_comp = re.search(r'href="/company/([^"]+)"', sec)
                            company = m_comp.group(1).replace('-', ' ').title() if m_comp else "YC / Venture-Backed Startup"

                            # 2. Extract each job in this startup block
                            job_matches = list(re.finditer(r'<a[^>]*href="(/jobs/(\d+)-([^"]+))"[^>]*>([^<]+)</a>', sec))
                            for idx, jm in enumerate(job_matches):
                                full_path, job_id, job_slug, link_text = jm.groups()
                                app_url = f"https://wellfound.com{full_path}"
                                if app_url in seen_urls:
                                    continue
                                seen_urls.add(app_url)

                                title = link_text.strip() or job_slug.replace("-", " ").title()

                                # Card snippet between this job and the next (or next 2500 chars)
                                start_pos = jm.end()
                                next_pos = job_matches[idx + 1].start() if idx + 1 < len(job_matches) else start_pos + 2500
                                card_html = sec[start_pos:next_pos]

                                # 3. Parse structured metadata spans in card
                                spans = re.findall(r'<span[^>]*class="[^"]*(?:pl-1|text-xs|font-semibold|font-medium)[^"]*"[^>]*>(.*?)</span>', card_html, re.S)
                                clean_spans = [' '.join(re.sub(r'<[^>]+>', ' ', s).split()).replace('·', '•').strip() for s in spans]
                                clean_spans = [s for s in clean_spans if s and len(s) > 1 and not s.isdigit()]

                                job_location = "Not Specified"
                                years_exp = None
                                salary_str = None

                                for span in clean_spans:
                                    # Check experience: e.g. "2 years of exp", "0 years of exp"
                                    m_exp = re.search(r'(\d+)\s+years?\s+of\s+exp', span, re.I)
                                    if m_exp and years_exp is None:
                                        years_exp = int(m_exp.group(1))
                                        continue

                                    # Check salary: e.g. "$20k • $25k", "₹21L • ₹28L"
                                    if any(cur in span for cur in ['$', '₹', '€', '£']) and ('k' in span.lower() or 'l' in span.lower() or '-' in span or '–' in span):
                                        if not salary_str:
                                            salary_str = span.replace('•', ' - ')
                                        continue

                                    # Check location
                                    if job_location == "Not Specified":
                                        loc_cand = span
                                        if '•' in loc_cand:
                                            parts = [p.strip() for p in loc_cand.split('•')]
                                            for p in parts:
                                                if any(k in p.lower() for k in ['in office', 'onsite', 'remote only', 'hybrid']):
                                                    continue
                                                loc_cand = p
                                                break

                                        # Clean prefixes and suffixes like "+ 4", "In office", "Remote only"
                                        loc_clean = re.sub(r'\s*\+\s*\d+.*', '', loc_cand).strip()
                                        loc_clean = re.sub(r'^(?:In office|Onsite or remote|Remote only|Remote|Hybrid)\s*', '', loc_clean, flags=re.I).strip()

                                        if "remote" in span.lower() or "worldwide" in span.lower() or "anywhere" in span.lower():
                                            if "india" in span.lower():
                                                job_location = "Remote - India"
                                            elif any(fk in span.lower() for fk in ["us only", "usa", "uk", "europe", "emea", "latam", "canada"]):
                                                job_location = span.replace('•', ' - ')
                                            else:
                                                job_location = "Remote"
                                        elif len(loc_clean) >= 2 and not any(k in loc_clean.lower() for k in ["equity", "salary", "stage", "employees", "series", "ago", "recruiter", "day", "month", "year", "full-time", "part-time"]):
                                            job_location = loc_clean or loc_cand

                                # 4. Location Fallback: If no explicit location span was found on card, fallback to query location
                                if job_location == "Not Specified":
                                    if loc_slug in ["bangalore", "delhi-ncr"]:
                                        job_location = f"{location.title()}, India"
                                    elif loc_lower and loc_lower not in ["remote", "fully remote", "worldwide", "anywhere"]:
                                        job_location = location.title()
                                    elif salary_str and '$' in salary_str:
                                        job_location = "Not Specified (USD Salary)"
                                    else:
                                        job_location = "Remote"

                                # 5. Build enriched description with real experience and salary
                                desc_parts = [f"{title} startup position at {company} in {job_location}."]
                                if years_exp is not None:
                                    desc_parts.append(f"Requires {years_exp} years of experience.")
                                if salary_str:
                                    desc_parts.append(f"Compensation: {salary_str}.")
                                desc_parts.append("Direct link on Wellfound.")
                                description = " ".join(desc_parts)

                                fingerprint = generate_job_fingerprint(title, company, job_location)
                                jobs.append({
                                    "title": title,
                                    "company": company,
                                    "location": job_location,
                                    "employment_type": "Full-Time" if "remote" not in job_location.lower() else "Remote",
                                    "salary_min": None,
                                    "salary_max": None,
                                    "description": description,
                                    "required_skills": [search_query] if search_query else ["Startups", "Software Engineering"],
                                    "application_url": app_url,
                                    "source_platform": "wellfound",
                                    "posted_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                                    "fingerprint": fingerprint
                                })
                    except Exception:
                        continue
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
        target_locations = [loc.strip() for loc in (locations or ["Remote"]) if loc and loc.strip()]
        if not target_locations:
            target_locations = ["Remote"]

        for title in titles[:4]:
            for loc in target_locations:
                linkedin_jobs = await self.fetch_linkedin_guest_jobs(title, loc)
                indeed_jobs = await self.fetch_indeed_jobs(title, loc)
                foundit_jobs = await self.fetch_foundit_jobs(title, loc)
                instahyre_jobs = await self.fetch_instahyre_jobs(title, loc)
                wellfound_jobs = await self.fetch_wellfound_jobs(title, loc)
                unstop_jobs = await self.fetch_unstop_jobs(title, loc)
                jsearch_jobs = await self.fetch_jsearch_jobs(title, loc)

                for job_list in [linkedin_jobs, indeed_jobs, foundit_jobs, instahyre_jobs, wellfound_jobs, unstop_jobs, jsearch_jobs]:
                    for j in job_list:
                        fp = j["fingerprint"]
                        if fp not in fingerprints_seen:
                            fingerprints_seen.add(fp)
                            all_jobs.append(j)

            # Global remote sources (queried once per title)
            remoteok_jobs = await self.fetch_remoteok_jobs(title)
            remotive_jobs = await self.fetch_remotive_jobs(title)
            arbeitnow_jobs = await self.fetch_arbeitnow_jobs(title)
            jobicy_jobs = await self.fetch_jobicy_jobs(title)

            for job_list in [remoteok_jobs, remotive_jobs, arbeitnow_jobs, jobicy_jobs]:
                for j in job_list:
                    fp = j["fingerprint"]
                    if fp not in fingerprints_seen:
                        fingerprints_seen.add(fp)
                        all_jobs.append(j)

        # Sort aggregate collection: Newest first (highest timestamp to lowest)
        all_jobs.sort(key=lambda j: self._parse_date(j.get("posted_date")), reverse=True)

        return all_jobs

