"""Compatibility wrapper: same as the `reel-studio` command."""
import sys

from reelstudio.cli import main

if __name__ == "__main__":
    sys.exit(main())
