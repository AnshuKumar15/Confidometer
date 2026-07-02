import re

FILLER_WORDS = [
    "um",
    "uh",
    "erm",
    "hmm",
    "like",
    "you know",
    "i mean",
    "well",
    "right",
    "so",
    "anyway",
    "honestly",
    "at the end of the day",
    "actually",
    "basically",
    "literally",
    "you know what i mean",
    "if that makes sense",
    "i guess",
    "i suppose",
    "more or less",
    "to be fair",
    "let me think",
    "you get me",
    "you know what",
    "and stuff",
    "or whatever",
    "maybe",
    "probably",
    "well uh",
    "actually",
    "uhm"
]


def count_fillers(transcript: str):

    transcript_lower = transcript.lower()

    count = 0
    found = []

    # Use word-boundary regex to avoid substring matches (e.g., "like" in "likely")
    for word in FILLER_WORDS:
        pattern = r"\b" + re.escape(word) + r"\b"
        matches = re.findall(pattern, transcript_lower)
        if matches:
            found.append((word, len(matches)))
            count += len(matches)

    if found:
        print(f"[DEBUG] Fillers found: {found}")

    return count