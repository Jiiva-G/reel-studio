"""Compatibility wrapper: same as `reel-studio analyze`."""
import sys

from reelstudio.cli import main

if __name__ == "__main__":
    sys.exit(main(["analyze", *sys.argv[1:]]))
