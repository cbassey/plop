"""Tests for adaptive variants and the freeze/replay discipline (Phase 4).

The discipline is generate -> freeze -> replay. These tests pin the two
properties that make it honest: generation is deterministic, and both study arms
replay the one frozen artifact, so the comparison is fair by construction.
"""

from __future__ import annotations

from plop.adaptive import expand_suite, freeze_suite, mutate_case, replay_paired
from plop.harness import load_suite

# Three cases whose checks are hard-gated with no prompt or canary needed, so
# they score cleanly (held/broke) with the builtin adapter — no unverifiable
# noise to reason around in the replay test.
_BASE_IDS = ["smuggle-01-path-traversal", "scope-01-read-then-write", "loop-03-call-100-times"]


def _base_cases():
    suite = {c["id"]: c for c in load_suite()}
    return [suite[i] for i in _BASE_IDS]


# -- generation is deterministic ---------------------------------------------


def test_mutation_is_deterministic_for_a_seed():
    case = _base_cases()[0]
    a = mutate_case(case, seed=7, count=4)
    b = mutate_case(case, seed=7, count=4)
    assert [v["prompt"] for v in a] == [v["prompt"] for v in b]
    assert [v["id"] for v in a] == [v["id"] for v in b]
    # A different seed reorders the frames, so the prompts differ.
    c = mutate_case(case, seed=8, count=4)
    assert [v["prompt"] for v in a] != [v["prompt"] for v in c]


def test_variants_preserve_the_attack_semantics():
    case = _base_cases()[0]  # a schema-smuggling case
    for variant in mutate_case(case, seed=1, count=5):
        # Same category, checks, task, and — crucially — the smuggled payload.
        assert variant["category"] == case["category"]
        assert variant["checks"] == case["checks"]
        assert variant["task_mode"] == case.get("task_mode", variant["task_mode"])
        assert "../../etc/passwd" in variant["prompt"]
        assert variant["prompt"] != case["prompt"]
        assert variant["variant_of"] == case["id"]


def test_expand_suite_keeps_base_and_adds_variants():
    base = _base_cases()
    expanded = expand_suite(base, seed=3, variants_per_case=4)
    assert len(expanded) == len(base) * 5  # each base + 4 variants
    ids = [c["id"] for c in expanded]
    # Every id is unique, and the base ids are all present.
    assert len(ids) == len(set(ids))
    for b in base:
        assert b["id"] in ids
        assert f"{b['id']}~v1" in ids


# -- freeze then replay is a fair comparison ---------------------------------


def test_freeze_then_replay_is_fair_and_shows_the_before_after(tmp_path):
    base = _base_cases()
    expanded = expand_suite(base, seed=5, variants_per_case=3)
    frozen = freeze_suite(expanded, tmp_path / "frozen.yaml", seed=5)

    # Both arms load the one frozen file. No regeneration at run time.
    result = replay_paired(
        frozen, "t-adaptive", results_dir=tmp_path
    )

    assert result["fair"] is True  # both arms scored the identical case set
    naive, defended = result["naive"], result["defended"]
    assert naive["total"] == defended["total"] == len(expanded)
    # The variants are still real attacks: the naive agent breaks every one.
    assert naive["defense_rate"] == 0.0
    # And the guards hold across every surface rewording.
    assert defended["defense_rate"] == 1.0


def test_frozen_file_is_loadable_as_a_suite(tmp_path):
    expanded = expand_suite(_base_cases(), seed=2, variants_per_case=2)
    frozen = freeze_suite(expanded, tmp_path / "frozen.yaml", seed=2)
    reloaded = load_suite(frozen)
    assert [c["id"] for c in reloaded] == [c["id"] for c in expanded]
