#!/bin/sh
# Shipshape write custody. PreToolUse guard for Edit/Write/MultiEdit/NotebookEdit.
#
# Enforces the "Write scopes are strict" Article from skills/shipshape/SKILL.md
# and the role contracts in skills/qm, skills/crew, skills/boatswain, and
# skills/shipwright. Doctrine lives in the skills; this script adds none.
# Delete this plugin and nothing is lost but enforcement.
#
# Role identity: the runtime names the running agent in the hook payload
# as agent_type, such as "shipshape:crew". Payloads with no shipshape
# agent_type are the human-facing main loop or a foreign agent; custody
# does not apply there. Quoted mentions of the field inside tool_input
# arrive JSON-escaped and cannot match the unescaped top-level key.

payload=$(cat)

role=$(printf '%s' "$payload" | sed -n 's/.*"agent_type":[[:space:]]*"shipshape:\([a-z]*\)".*/\1/p')
[ -z "$role" ] && exit 0

file_path=$(printf '%s' "$payload" | sed -n 's/.*"file_path":[[:space:]]*"\([^"]*\)".*/\1/p')
# NotebookEdit carries the target as notebook_path, not file_path.
[ -z "$file_path" ] && file_path=$(printf '%s' "$payload" | sed -n 's/.*"notebook_path":[[:space:]]*"\([^"]*\)".*/\1/p')
[ -z "$file_path" ] && exit 0

cwd=$(printf '%s' "$payload" | sed -n 's/.*"cwd":[[:space:]]*"\([^"]*\)".*/\1/p')
rel="$file_path"
[ -n "$cwd" ] && rel="${file_path#"$cwd"/}"
base=$(basename "$file_path")

deny() {
  echo "Shipshape custody: $role MUST NOT write $rel. $1 (Article: Write scopes are strict.)" >&2
  exit 2
}

# Project directories from RIGGING.md (## Directories). Values are optional;
# absent values simply narrow what custody can check.
rigdir=""
if [ -n "$cwd" ] && [ -f "$cwd/RIGGING.md" ]; then
  rigdir="$cwd/RIGGING.md"
elif [ -f "RIGGING.md" ]; then
  rigdir="RIGGING.md"
fi
impl="" specs="" verif="" assets=""
if [ -n "$rigdir" ]; then
  impl=$(sed -n 's/^- implementation:[[:space:]]*//p' "$rigdir" | head -1 | tr -d '`' | sed 's/[[:space:]]*$//')
  specs=$(sed -n 's/^- specs:[[:space:]]*//p' "$rigdir" | head -1 | tr -d '`' | sed 's/[[:space:]]*$//')
  verif=$(sed -n 's/^- verification:[[:space:]]*//p' "$rigdir" | head -1 | tr -d '`' | sed 's/[[:space:]]*$//')
  assets=$(sed -n 's/^- assets:[[:space:]]*//p' "$rigdir" | head -1 | tr -d '`' | sed 's/[[:space:]]*$//')
fi

# in_dirs <rel> <comma-separated dirs> -> exit status 0 when rel is inside any
in_dirs() {
  p="$1"
  dirs="$2"
  old_ifs="$IFS"; IFS=','
  for d in $dirs; do
    d=$(printf '%s' "$d" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    d="${d%/}"
    [ -z "$d" ] && continue
    case "$p" in
      "$d"/*|"$d") IFS="$old_ifs"; return 0 ;;
    esac
  done
  IFS="$old_ifs"; return 1
}

case "$role" in
  qm)
    # skills/qm/SKILL.md: "Write only verification: tests, fixtures, step
    # definitions, harness, test support." "MUST NOT read CAPTAIN.md."
    case "$base" in
      *.feature) deny "Captain writes specs." ;;
      CAPTAIN.md|watchbill.json|AGENTS.md|RIGGING.md) deny "Captain-custodied or configuration artifact." ;;
    esac
    [ -n "$impl" ] && in_dirs "$rel" "$impl" && deny "Production code belongs to Crew."
    [ -n "$assets" ] && in_dirs "$rel" "$assets" && deny "Assets are Captain-custodied."
    ;;
  crew)
    # skills/crew/SKILL.md: "Write production code only. No specs, tests,
    # fixtures, harness, assets, or Captain notes."
    case "$base" in
      *.feature) deny "Captain writes specs." ;;
      CAPTAIN.md|watchbill.json|AGENTS.md|RIGGING.md) deny "Captain-custodied or configuration artifact." ;;
    esac
    [ -n "$verif" ] && in_dirs "$rel" "$verif" && deny "Verification belongs to QM."
    [ -n "$specs" ] && in_dirs "$rel" "$specs" && deny "Specs belong to Captain."
    [ -n "$assets" ] && in_dirs "$rel" "$assets" && deny "Assets are Captain-custodied."
    ;;
  boatswain)
    # skills/boatswain/SKILL.md: "MAY read CAPTAIN.md ...; MUST NOT edit it."
    case "$base" in
      CAPTAIN.md) deny "Boatswain MAY read Captain notes and MUST NOT edit them." ;;
    esac
    ;;
  shipwright)
    # skills/shipwright/SKILL.md: "Never change production-code behaviour,
    # verification, assets/, CAPTAIN.md, or watchbill.json."
    case "$base" in
      CAPTAIN.md|watchbill.json) deny "Shipwright never changes Captain-custodied working artifacts." ;;
    esac
    [ -n "$verif" ] && in_dirs "$rel" "$verif" && deny "Shipwright never changes verification."
    [ -n "$assets" ] && in_dirs "$rel" "$assets" && deny "Shipwright never changes assets."
    ;;
esac

exit 0
