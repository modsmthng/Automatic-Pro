---
title: Troubleshooting
description: Common issues, taste corrections, and setup notes for Automatic Pro users.
---

## Low pressure or no coffee is extracted

Start with the simple checks first:

- Grind finer if you want higher pressure, especially because pre-infusion changes the way pressure ramps up.
- Confirm that you picked the correct dose file for your basket.
- If your basket has more headspace than expected, review the headspace-dependent logic in [How Automatic Pro v2 Works](../how-automatic-pro-v2-works/).
- In time mode, remember that the last phase may need to be shortened or extended to match your real flow.

## The shot tastes sour or salty

Try:

- A higher ratio like `1:2.5+`
- A slightly higher temperature
- The stable `v2` branch if you are currently experimenting on `vIT3`

## The shot tastes bitter or dry

Try:

- A lower ratio like `1:1.5-`
- A slightly lower temperature
- A less aggressive grind if the flow is stalling late in the shot

## Time mode feels inconsistent

Time mode is most useful as a practical approximation when no scale is available.

- Use the formula from [Quick Start / Dialing In](../quick-start/) as the baseline.
- If the shot ends too early or too late, adjust the last phase duration to reflect your real observed flow.
- If you do use a scale, weight mode is usually the more reliable way to stop the shot.

## Testing branch caveats

The vIT3 branch is intentionally marked as experimental.

- Expect edge cases and occasional errors.
- Use it for feedback and experimentation, not because you need the most conservative recommendation.
- Share your findings on [GaggiMate Discord](https://discord.com/invite/3JcR5csD4E) if you adapt the profile to new doses or basket styles.
