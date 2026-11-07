#!/usr/bin/env python3
"""Link shared skills into Codex, preserving replaced files in a dated backup."""

import argparse
from datetime import datetime
from pathlib import Path
import shutil


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path.home() / "Code/skills/skills")
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    skills = sorted(p for p in source.iterdir() if (p / "SKILL.md").is_file())
    if not skills:
        parser.error(f"No skills found in {source}")

    home = Path.home()
    target = home / ".agents/skills"
    legacy = home / ".codex/skills"
    backup = home / ".local/share/skill-backups" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    target.mkdir(parents=True, exist_ok=True)

    def preserve(path, scope):
        destination = backup / scope / path.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(path), str(destination))
        print(f"Backed up {path} -> {destination}")

    for skill in skills:
        link = target / skill.name
        if link.is_symlink() and link.resolve() == skill:
            pass
        else:
            if link.exists() or link.is_symlink():
                preserve(link, "agents")
            link.symlink_to(skill, target_is_directory=True)
            print(f"Linked {link} -> {skill}")

        # Remove duplicate discovery entries only after the canonical link exists.
        old = legacy / skill.name
        if old.exists() or old.is_symlink():
            preserve(old, "codex")

    for skill in skills:
        assert (target / skill.name).resolve() == skill
        assert (target / skill.name / "SKILL.md").is_file()
    print(f"Verified {len(skills)} shared skills in {target}")
    if backup.exists():
        print(f"Backup: {backup}")


if __name__ == "__main__":
    main()
