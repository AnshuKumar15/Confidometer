import math

def bell_curve_score(value: float, ideal: float, width: float) -> float:
    """Gaussian bell-curve: 100 at ideal, decaying towards 0."""
    return 100.0 * math.exp(-((value - ideal) / width) ** 2)
