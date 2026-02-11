### Schelling's Model of Segregation Simulation

This is a simulation of [Schelling's Model of Segregation](https://www.stat.berkeley.edu/~aldous/157/Papers/Schelling_Seg_Models.pdf).

- There are two types of "agents", Red and Blue, representing two groups of people with some characteristic.
- Agents reside in cells in the grid.
- Agents want to move to a place where they have $t$ neighbors (above, left, right, below, or diagonal) of their own kind.
  - If they have $t$ neighbors of there own kind, they are _satisfied_ and will not move.
  - If they have fewer than $t$ neighbors of their own kind, they are unsatisfied and will move to a random empty cell, that will make them satisfied.
  - If there are no empty cells that will make them satisfied, they will move to a random empty cell.
- The simulation continues until all agents are satisfied.
- The result is a pattern of segregation, where agents of the same kind cluster together.

#### Reducing Noise

To try to fix the problem of "floating" agents, where major clusters form, but agents don't join (because $t$ may not be met), the simulation uses a fallback:

- First, agents look for a spot where they will have $\geq t$ neighbors.
- If that doesn't exist, they move to an empty spot with the highest number of neighbors of the same type, instead of floating around randomly.
- Otherwise, they move to a random empty spot.

Run the simulation [here](https://k0src.github.io/Schellings-Model-Simulation/) or clone this repository and open `index.html` in a web browser.
