# Falsifier Notes

- The cleanup-race patch remains the highest-leverage next step even if some of the recurring window errors are local-dev-specific, because those errors currently poison the agent's debugging surface.
- The patch should not be worker-side no-op only. It should be paired with at least one control-plane or reset-drain validation so the system does not silently normalize premature deletion.
- The next relaunch should still be considered a runtime validation pass because the preflight patch has not yet been proven through a fresh full loop.
