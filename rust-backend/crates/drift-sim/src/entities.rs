// Entity resolution — O(1) lookups by name.
// Mirrors src/core/entities.ts.

use std::collections::HashMap;

use crate::state::{AsteroidBeltEntry, AsteroidEntry, BodyEntry, State};

// ---------------------------------------------------------------------------
// Entity maps (stored inside State)
// ---------------------------------------------------------------------------

#[derive(Debug, Default)]
pub struct EntityMaps {
    /// body_name → index into state.body_meshes
    pub bodies: HashMap<String, usize>,
    /// asteroid designation → (belt_index, asteroid_index)
    pub asteroids: HashMap<String, (usize, usize)>,
}

/// Resolved entity returned by `resolve_entity`.
#[derive(Debug, Clone)]
pub struct ResolvedEntity {
    pub name: String,
    pub body_type: String,
    pub position: [f32; 3],
    pub is_moon: bool,
    pub body_entry: Option<BodyEntryRef>,
    pub asteroid_hit: Option<AsteroidHit>,
}

#[derive(Debug, Clone)]
pub struct BodyEntryRef {
    pub name: String,
    pub body_type: String,
}

#[derive(Debug, Clone)]
pub struct AsteroidHit {
    pub asteroid: AsteroidEntry,
    pub belt_entry_index: usize,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Rebuild entity lookup maps from the current body_meshes and asteroid_belts.
/// Must be called after adding/removing bodies.
pub fn rebuild_entity_maps(state: &mut State) {
    state.entity_maps.bodies.clear();
    state.entity_maps.asteroids.clear();

    for (idx, entry) in state.body_meshes.iter().enumerate() {
        state
            .entity_maps
            .bodies
            .insert(entry.data.name.clone(), idx);
    }

    for (belt_idx, belt) in state.asteroid_belts.iter().enumerate() {
        for (ast_idx, asteroid) in belt.asteroids.iter().enumerate() {
            state
                .entity_maps
                .asteroids
                .insert(asteroid.designation.clone(), (belt_idx, ast_idx));
        }
    }
}

/// Resolve any entity (body or asteroid) by name.
/// Returns `(Some(entity), true)` on success, `(None, false)` on miss.
pub fn resolve_entity(name: &str, state: &State) -> (Option<ResolvedEntity>, bool) {
    // Try body first
    if let Some(&idx) = state.entity_maps.bodies.get(name) {
        let entry = &state.body_meshes[idx];
        let resolved = ResolvedEntity {
            name: entry.data.name.clone(),
            body_type: entry.data.body_type.clone(),
            position: entry.position,
            is_moon: entry.is_moon,
            body_entry: Some(BodyEntryRef {
                name: entry.data.name.clone(),
                body_type: entry.data.body_type.clone(),
            }),
            asteroid_hit: None,
        };
        return (Some(resolved), true);
    }

    // Try asteroid
    if let Some(&(belt_idx, ast_idx)) = state.entity_maps.asteroids.get(name) {
        let belt = &state.asteroid_belts[belt_idx];
        let asteroid = &belt.asteroids[ast_idx];
        let pos_x = belt.positions.get(ast_idx * 3).copied().unwrap_or(0.0);
        let pos_y = belt.positions.get(ast_idx * 3 + 1).copied().unwrap_or(0.0);
        let pos_z = belt.positions.get(ast_idx * 3 + 2).copied().unwrap_or(0.0);
        let resolved = ResolvedEntity {
            name: asteroid.designation.clone(),
            body_type: "Asteroid".to_string(),
            position: [pos_x, pos_y, pos_z],
            is_moon: false,
            body_entry: None,
            asteroid_hit: Some(AsteroidHit {
                asteroid: asteroid.clone(),
                belt_entry_index: belt_idx,
            }),
        };
        return (Some(resolved), true);
    }

    (None, false)
}

/// Find a body entry by name (includes ships, comets, moons).
pub fn find_body<'a>(name: &str, state: &'a State) -> (Option<&'a BodyEntry>, bool) {
    if let Some(&idx) = state.entity_maps.bodies.get(name) {
        return (Some(&state.body_meshes[idx]), true);
    }
    (None, false)
}

/// Find a planet/moon/dwarf entry — excludes ships and comets.
pub fn find_planet<'a>(name: &str, state: &'a State) -> (Option<&'a BodyEntry>, bool) {
    if let Some(&idx) = state.entity_maps.bodies.get(name) {
        let entry = &state.body_meshes[idx];
        if !entry.is_ship && !entry.is_comet {
            return (Some(entry), true);
        }
    }
    (None, false)
}

/// Find a ship entry by name. If name is None, returns the first ship.
pub fn find_ship<'a>(name: Option<&str>, state: &'a State) -> (Option<&'a BodyEntry>, bool) {
    match name {
        Some(n) => {
            if let Some(&idx) = state.entity_maps.bodies.get(n) {
                let entry = &state.body_meshes[idx];
                if entry.is_ship {
                    return (Some(entry), true);
                }
            }
            (None, false)
        }
        None => {
            let ship = state.body_meshes.iter().find(|e| e.is_ship);
            (ship, ship.is_some())
        }
    }
}

/// Find the first star body.
pub fn find_star(state: &State) -> (Option<&BodyEntry>, bool) {
    let star = state
        .body_meshes
        .iter()
        .find(|e| e.data.body_type == "Star");
    (star, star.is_some())
}

/// Find an asteroid by designation.
pub fn find_asteroid_entity<'a>(
    designation: &str,
    state: &'a State,
) -> (Option<AsteroidHitRef<'a>>, bool) {
    if let Some(&(belt_idx, ast_idx)) = state.entity_maps.asteroids.get(designation) {
        let belt = &state.asteroid_belts[belt_idx];
        let asteroid = &belt.asteroids[ast_idx];
        let pos_x = belt.positions.get(ast_idx * 3).copied().unwrap_or(0.0);
        let pos_y = belt.positions.get(ast_idx * 3 + 1).copied().unwrap_or(0.0);
        let pos_z = belt.positions.get(ast_idx * 3 + 2).copied().unwrap_or(0.0);
        return (
            Some(AsteroidHitRef {
                asteroid,
                belt_entry: belt,
                position: [pos_x, pos_y, pos_z],
            }),
            true,
        );
    }
    (None, false)
}

pub struct AsteroidHitRef<'a> {
    pub asteroid: &'a AsteroidEntry,
    pub belt_entry: &'a AsteroidBeltEntry,
    pub position: [f32; 3],
}

/// List all ship entries.
pub fn list_ships(state: &State) -> Vec<&BodyEntry> {
    state.body_meshes.iter().filter(|e| e.is_ship).collect()
}

/// List all ships orbiting at a given body (state == "orbiting").
pub fn list_ships_at_body<'s>(body_name: &str, state: &'s State) -> Vec<&'s BodyEntry> {
    state
        .body_meshes
        .iter()
        .filter(|e| {
            e.is_ship
                && e.host_planet_name.as_deref() == Some(body_name)
                && e.ship_state.as_deref() == Some("orbiting")
        })
        .collect()
}
