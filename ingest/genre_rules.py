"""
Genre canonicalization for Shirimim.

iTunes returns fine-grained genres ("Hard Rock", "Rap", "Adult Alternative").
This folds the near-duplicates into a smaller set of canonical buckets so the
genre picker isn't fragmented — e.g. a 30-track "Rap" genre is pointless next
to a 700-track "Hip-Hop/Rap".

Edit GENRE_ALIASES to taste: keys are matched case-insensitively against the
raw iTunes genre; any genre not listed passes through unchanged. After editing,
re-apply it to the whole library (no API calls, instant) with:

    python backfill_metadata.py --normalize-only

For language-specific genres iTunes doesn't reliably tag (e.g. Mizrahi), don't
use this map — ingest those songs from a dedicated CSV with the genre forced:

    python ingest.py mizrahi.csv --genre Mizrahi
"""

# raw genre (lowercased) -> canonical genre
GENRE_ALIASES = {
    # --- Hip-Hop / Rap ---
    "rap": "Hip-Hop/Rap",
    "hip hop": "Hip-Hop/Rap",
    "hip-hop": "Hip-Hop/Rap",
    "rap/hip hop": "Hip-Hop/Rap",
    "trap": "Hip-Hop/Rap",
    "drill": "Hip-Hop/Rap",
    "underground rap": "Hip-Hop/Rap",
    "alternative rap": "Hip-Hop/Rap",
    "conscious hip hop": "Hip-Hop/Rap",
    "uk hip-hop": "Hip-Hop/Rap",
    "gangsta rap": "Hip-Hop/Rap",
    "hardcore rap": "Hip-Hop/Rap",
    "pop rap": "Hip-Hop/Rap",
    "east coast rap": "Hip-Hop/Rap",
    "west coast rap": "Hip-Hop/Rap",
    "southern hip hop": "Hip-Hop/Rap",
    "dirty south": "Hip-Hop/Rap",

    # --- Rock (incl. hard rock, metal, punk) ---
    "hard rock": "Rock",
    "album rock": "Rock",
    "classic rock": "Rock",
    "arena rock": "Rock",
    "soft rock": "Rock",
    "metal": "Rock",
    "heavy metal": "Rock",
    "punk": "Rock",
    "punk rock": "Rock",
    "pop-punk": "Rock",
    "grunge": "Rock",

    # --- Alternative / Indie ---
    "alternative rock": "Alternative",
    "adult alternative": "Alternative",
    "indie": "Alternative",
    "indie rock": "Alternative",
    "indie pop": "Alternative",
    "college rock": "Alternative",
    "emo": "Alternative",

    # --- Pop ---
    "dance-pop": "Pop",
    "teen pop": "Pop",
    "pop/rock": "Pop",
    "adult contemporary": "Pop",

    # --- Electronic / Dance ---
    "dance": "Electronic",
    "house": "Electronic",
    "edm": "Electronic",
    "techno": "Electronic",
    "dubstep": "Electronic",
    "electronica": "Electronic",
    "drum & bass": "Electronic",

    # --- R&B / Soul ---
    "r&b": "R&B/Soul",
    "soul": "R&B/Soul",
    "contemporary r&b": "R&B/Soul",
    "neo-soul": "R&B/Soul",
    "funk": "R&B/Soul",
}


def canonical_genre(raw):
    """Fold a raw iTunes genre into its canonical bucket.

    Unknown genres pass through unchanged. Returns None for empty input.
    """
    if not raw:
        return None
    return GENRE_ALIASES.get(raw.strip().lower(), raw.strip())


# ---------------------------------------------------------------------------
# Mizrahi tagging — iTunes doesn't reliably label Mizrahi music, so it is keyed
# off a curated artist list instead. Add artists here as the library grows;
# re-apply to the existing library with `python backfill_metadata.py`.
# ---------------------------------------------------------------------------
MIZRAHI_ARTISTS = {
    "עומר אדם",
    "אושר כהן",
    "עדן בן זקן",
    "אייל גולן",
    "פאר טסי",
    "אודיה",
    "זוהר ארגוב",
    "עדן חסון",
    "מושיק עפיה",
    "משה פרץ",
    "ליאור נרקיס",
    "דודו אהרון",
    "נסרין קדרי",
    "אגם בוחבוט",
    "קובי פרץ",
    "איתי לוי",
    "שרית חדד",
    "בועז מעודה",
    "אבי אבורומי",
}


def is_mizrahi_artist(artist):
    """True if the artist is a known Mizrahi act (see MIZRAHI_ARTISTS)."""
    return bool(artist) and artist.strip() in MIZRAHI_ARTISTS
