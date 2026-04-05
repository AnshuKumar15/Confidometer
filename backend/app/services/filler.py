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

    for word in FILLER_WORDS:
        count += transcript_lower.count(word)

    return count