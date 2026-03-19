# Team Picking Algorithm

An approach to optimally selecting 13 teams for the Pick 100 pool, given a set of tournament win probabilities from an external prediction model (e.g. Nate Silver's or Ken Pomeroy's).

## Scoring Rules

- Pick **13 teams** whose seeds sum to exactly **100**
- For each game a team wins: **seed + round_bonus** points
- Round bonuses: R64=1, R32=2, S16=4, E8=8, F4=16, Finals=32

## Algorithm Overview

### Step 1: Compute Independent Expected Points

For each team, compute the naive expected points assuming no interactions with other picked teams:

```
EP(team) = sum over rounds of P(win round) * (seed + round_bonus)
```

Where `P(win round R)` = probability of reaching the round *after* R (i.e., making it to the next round), taken directly from the projection model's cumulative survival probabilities.

### Step 2: Conflict-Adjusted Expected Points

When two picked teams are in the same region, they may meet in the bracket. The standard NCAA bracket structure determines when seeds meet:

| Bracket Pod | Seeds | Meet in |
|-------------|-------|---------|
| A | 1, 16, 8, 9 | R64 (1v16, 8v9), R32 (winners play) |
| B | 5, 12, 4, 13 | R64 (5v12, 4v13), R32 (winners play) |
| C | 6, 11, 3, 14 | R64 (6v11, 3v14), R32 (winners play) |
| D | 7, 10, 2, 15 | R64 (7v10, 2v15), R32 (winners play) |

Pods A+B meet in the Sweet 16; Pods C+D meet in the Sweet 16; all four meet in the Elite 8.

When two of your teams collide, only one can advance. The conflict adjustment (from [willmoorefyi/pick100-pool-optimizer](https://github.com/willmoorefyi/pick100-pool-optimizer/tree/mainline)) discounts each team's probabilities from the meeting round onward:

```
opp_reach   = P(opponent reaches the meeting round)
share       = P(team advances) / (P(team advances) + P(opponent advances))
factor      = (1 - opp_reach) + opp_reach * share
adjusted_prob[round] *= factor   (for meeting round and all later rounds)
```

This is applied to *both* teams in the collision, so the combined EP of a conflicting pair is always less than the sum of their independent EPs.

**Why this matters:** Our naive optimal lineup (151.4 naive EP) scored only 134.9 adjusted EP due to packing 4 teams into the East region and 3 into South. The conflict-adjusted optimal (149.5 naive EP) scored 145.9 adjusted EP by spreading teams across bracket pods; an 11-point improvement in realistic expected value.

### Step 3: Beam Search Optimization

Find the 13-team lineup with seeds summing to 100 that maximizes conflict-adjusted EP.

This uses a DP beam search (similar to [the reference optimizer](https://github.com/willmoorefyi/pick100-pool-optimizer/blob/mainline/src/optimizer.ts)):

1. Sort teams by `naive_EP / seed` (value density) for better exploration order
2. Build lineups incrementally, one team at a time
3. At each level, bucket partial lineups by their current seed sum
4. Prune each bucket to the top N states by conflict-adjusted EP (beam width = 300-500)
5. At level 13, the bucket at seed_sum=100 contains the final candidates

The conflict-adjusted EP is recomputed at every step (not just at the end), so the search naturally steers away from collision-heavy lineups throughout the process.

## Key Findings

### Three 1-seeds is optimal

The scoring formula heavily rewards low seeds that win many games. A 1-seed winning the championship earns 33 points for that single game (1+32), and 1-seeds have ~20-30% championship probability. Three 1-seeds (Arizona, Duke, Michigan) form the core at 72.3 of 145.9 adjusted EP.

A fourth 1-seed forces three 16-seed filler slots and crowds the remaining mid-tier picks into conflicting regions; net result is 8+ fewer adjusted EP.

### Filler slots are unavoidable

With three 1-seeds (cost: 3 seed points), the remaining 10 picks must sum to 97 (avg 9.7/pick). The bottom 1-2 slots inevitably go to 15/16-seeds that contribute < 1 EP each. This is the tax for loading up on 1-seeds; it's worth paying.

### Conflict avoidance > raw talent

The most important insight from this analysis: **spreading teams across bracket pods matters more than picking the highest-EP individuals**. Illinois (15.6 naive EP) looks better than Vanderbilt (12.4 naive EP), but putting Illinois in the South region alongside Houston creates a conflict that costs both teams. Vanderbilt avoids that collision, making it the better pick in context.

### Ceiling doesn't predict outcomes

Historical analysis of 488 brackets across 12 years showed little correlation between a bracket's ceiling (theoretical maximum points) and final score. Expected value is a better optimization target than ceiling.

## Tools and References

- **Ceiling calculator**: [`client/js/services/ceilingCalculator.js`](client/js/services/ceilingCalculator.js) (computes max possible points and detects R1/R2 collisions)
- **Bracket config**: [`client/js/config.js`](client/js/config.js) (Final Four pairings: East vs South, Midwest vs West)
- **Reference optimizer**: [willmoorefyi/pick100-pool-optimizer](https://github.com/willmoorefyi/pick100-pool-optimizer/tree/mainline) (conflict-adjusted EP calculation and beam search approach)
