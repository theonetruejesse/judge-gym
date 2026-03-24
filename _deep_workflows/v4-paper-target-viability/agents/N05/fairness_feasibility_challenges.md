# N05 Fairness And Feasibility Challenges

## Main Challenge

The biggest V4 risk is not "can we find candidate papers." It is "can we audit them without quietly inventing a different experiment." A paper only counts as a fair `judge-gym` target if the baseline can be reconstructed closely enough that later perturbations say something about the original evaluator regime, not about our approximation errors.

## Red Flags

- missing or weak access to original evidence items;
- prompt or rubric ambiguity that forces too much reverse engineering;
- result surfaces that depend on hidden preprocessing or proprietary annotation steps;
- tasks that require a pairwise or comparative evaluation mode not yet represented cleanly in the current engine;
- papers that are useful rhetorically but would be easy to accuse of strawman replication.

## Fair V4 Selection Rule

Select targets that satisfy all of these:

- public or reconstructable evidence universe;
- recoverable rubric or prompting protocol;
- a baseline that can be implemented faithfully before perturbation;
- clear expected payoff from changing abstention, framing, scale, grouping, or evaluator placement;
- enough external legibility that the result matters beyond this repo.

## Consequence For Shortlisting

This rule cuts against making `Törnberg` the lead target unless materials are confirmed. It also cuts against turning the methods literature into the core empirical program. The safest high-payoff center of gravity is:

- `Gilardi`;
- `Ziems` at subset scope;
- `Santurkar` as a broadened companion;
- one comparator such as `Zheng` or `Shi`.

## Engine Feasibility Constraint

V4 should avoid choosing a target that forces too many simultaneous platform changes. If a paper requires pairwise judging, novel aggregation, and a fundamentally new evidence type all at once, it should be a later-wave target rather than a launch target.
