const defaultSuggestedSets = [
    { id: "analytics", name: "Analytics fundamentals", traitNames: ["Analytical Thinking", "Data Storytelling", "Technical Aptitude", "Business Acumen", "Problem Solving", "Initiative & Learning Agility"] },
    { id: "leadership", name: "Leadership + teamwork", traitNames: ["Leadership", "Communication", "Collaboration", "Initiative & Learning Agility", "Interpersonal Skills"] },
    { id: "execution", name: "Execution mindset", traitNames: ["Initiative & Learning Agility", "Technical Aptitude", "Accountability", "Adaptability", "Drive"] }
];
/** Resolve trait names to trait IDs from the current trait list. */
export function resolveSuggestedSet(set, traits) {
    const nameToId = new Map(traits.map((t) => [t.name, t.id]));
    return set.traitNames.map((name) => nameToId.get(name)).filter((id) => id != null);
}
export function getSuggestedSets(_programId, _degreeLevel, _department) {
    // Could key by programId / degreeLevel / department for program-specific sets later.
    return defaultSuggestedSets;
}
