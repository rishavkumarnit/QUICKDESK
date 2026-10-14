"""Backward-compatible entry point for ``python -m app.seed``."""

from app.scripts.seed import main


if __name__ == "__main__":
    main()
