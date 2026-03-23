# Aurora 4X Resource & Survey Mechanics Reference

Reference document for Drift's resource system design. Inspired by Aurora 4X but with original naming and mechanics.

## Aurora's 11 Transnewtonian Minerals

| Mineral | Primary Use |
|---------|------------|
| Duranium | Factories, mines, ship structures (most common) |
| Sorium | Refined into fuel, jump drives, jump gates |
| Corbomite | Shields, stealth, electronic warfare |
| Tritanium | Missiles, ordnance factories |
| Boronide | Power systems, capacitors, terraforming |
| Uridium | Sensors, fire control, computing |
| Corundium | Energy weapons |
| Mercassium | Research facilities, life support, tractor beams |
| Vendarite | Fighters, fighter factories, fighter bases |
| Gallicite | Engines (all types), maintenance supplies |
| Neutronium | Shipyards, advanced armor, kinetic weapons |

Key insight: Each mineral serves specific tech roles, creating natural bottleneck progression.

## Geological Survey Mechanic

- Ships equipped with **Geological Survey Sensors** generate survey points in orbit
- Base version: 1 survey point/hour, improved variants via research
- ~5% of bodies contain minerals
- Two discovery chances: orbital survey + ground team (25% of normal rate)
- Survey must complete before mining facilities can be built

## Mineral Deposit Structure

Each deposit has:
- **Quantity** — Total tons available
- **Accessibility** (0.1–1.0) — Extraction efficiency multiplier

### Accessibility Depletion (Planets/Moons only)
1. **Phase 1:** Constant accessibility until 50% mined
2. **Phase 2:** Accessibility gradually decreases toward 0.1
3. **Phase 3:** Mining continues at 0.1 until exhaustion

Asteroids and comets: NO accessibility degradation (constant rate until depleted).

## Mining Rate Formula

```
Rate = BaseRate × SectorBonus × GovernorBonus × Accessibility
```

Example: 6 tons/year/mine at 1.0 access = 6t/y; at 0.1 = 0.6t/y

## Resource Distribution by Body Type

| Body Type | Quantity | Accessibility | Notes |
|-----------|----------|--------------|-------|
| Terrestrial Planets | Large | Low-Medium | Most reliable source |
| Moons | Small-Medium | Medium-High | Easier mining |
| Asteroids | Small | High | Fast extraction, limited supply |
| Gas Giants | Varies | Varies | Heavy Sorium concentration |
| Comets | 10,000+ tons | High | Risk of orbital decay |

## Design Takeaways for Drift

1. Resource interdependencies create strategic depth
2. Accessibility as a difficulty scaling mechanic (not just quantity)
3. Body type diversity encourages exploration trade-offs
4. Depletion curve (easy first 50-80%, progressively harder) adds long-term planning
5. Survey tech levels gate discovery — higher sensors reveal rarer deposits
6. All generation must be deterministic (seeded RNG)
