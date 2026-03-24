# Crew Career System Design

Future system for officer careers, training, and progression. Built on the `Commander` foundation (judgment skill + experience counter) already in place.

## Foundation (Implemented)

- `Commander` interface: `{ judgment: number; experience: number }`
- Ships start with judgment 0.3 (green academy graduate)
- Judgment enables preemptive servicing at colonies (smart departure decisions)
- Learning from failure: malfunctions and emergency-returns bump judgment with diminishing returns
- Experience counter increments on each completed action
- Judgment caps at 0.9 (nobody's perfect)

## Phase 1: Named Officers

- `Officer` interface: name, rank, skills, experience history
- Officers assigned to ships as commander
- Officer roster tracked at fleet/colony level
- UI panel showing officer details on ship selection

### Ranks

Academy Cadet -> Ensign -> Lieutenant -> Commander -> Captain

Promotion gates:
- Ensign: Complete academy (time-based, ~90 days)
- Lieutenant: X completed actions + minimum judgment threshold
- Commander: Survived N malfunctions, completed Y surveys, judgment > 0.5
- Captain: judgment > 0.7, experience > threshold, no ship losses

### Skills (expand beyond judgment)

- **Judgment** (existing): preemptive servicing decisions
- **Navigation**: affects transfer fuel efficiency (reduces delta-v waste)
- **Survey**: affects survey duration (faster surveys at higher skill)
- **Engineering**: affects malfunction severity (reduces damage taken)
- **Leadership**: affects morale decay rate (crew stays happier longer)

Each skill 0.0-1.0, grows through relevant actions:
- Navigation improves from transfers
- Survey improves from completed surveys
- Engineering improves from surviving malfunctions
- Leadership improves from shore leave management (maintaining high morale over time)
- Judgment improves from failures (as currently implemented)

## Phase 2: Academy & Training

- Academy is a colony building/facility
- Cadets train for N days before becoming Ensigns
- Training duration affected by academy quality (colony facility level)
- Cadets can specialize in one skill area for a boost
- Multiple cadets can train simultaneously

### Training Mechanics

- Passive training: slow skill growth while at academy (0.01/day base)
- Active training: assign to a skill focus for 2x growth in that area
- Mentorship: experienced officers at colony boost cadet training rate
- Graduation: cadet becomes Ensign with base skills + training bonuses

## Phase 3: Crew Roster & Assignment

- Ships have crew slots (bridge officers, engineering, science)
- Officers can be transferred between ships at colonies
- Junior officers serve under senior officers and gain experience
- When a commander is promoted or reassigned, the next senior officer steps up
- Officer death/retirement creates vacancies that must be filled

### Punishment & Consequences

- Malfunctions due to low judgment: mark on officer record
- Ship destruction: surviving officers get a negative trait ("cautious" = slower but safer)
- Repeated failures at same rank: promotion blocked until skills improve
- Officers who cause too many incidents can be demoted or reassigned to training

### Reward & Recognition

- Successful survey campaigns: bonus to survey skill
- Surviving long deployments: leadership bonus
- Clean maintenance record: engineering bonus
- Discovering rare resources: permanent "Lucky" trait (minor RNG bonus)

## Phase 4: Player Interaction

### UI Elements Needed

- Officer roster panel (fleet-level view)
- Ship crew assignment screen
- Academy management (at colony)
- Officer detail card (skills, history, traits)
- Promotion/demotion controls

### Player Decisions

- Which cadets to train and in what specialization
- Which officers to assign to which ships
- When to promote (early promotion = lower skills, late = missed opportunities)
- Risk tolerance: send green crew on dangerous missions for fast learning, or play it safe

## Open Questions

- How many officers per ship? (1 commander + N department heads?)
- Can officers die in malfunctions or just get injured?
- Should there be a salary/cost system for officers?
- How does this interact with the existing morale system? (crew morale vs officer morale?)
- Should officers have personality traits that affect compatibility?
- Inter-system travel: do officers stay with their ship or can they be reassigned across systems?
