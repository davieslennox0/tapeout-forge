"""The voice-over script, written to be READ ALOUD by an upbeat presenter to three listeners at once:
a newcomer, an investor and a developer. Short sentences, plain words, no jargon without a picture next to it.

`show` is what appears on screen (revealed word by word as it is spoken);
`say` is what the voice reads (spelled so the names and numbers are pronounced properly);
`ev` names the moment in the scene that this line cues (a click, a tick, a bar growing)."""

SCENES = [
    {"id": "s1", "min": 5.0, "lines": [
        {"show": "Meet ForgeOut! Smaller on-chain circuits, checked identical.",
         "say": "Meet Forge Out! Smaller on-chain circuits, checked identical."},
        {"show": "Whether you build circuits, fund them, or you're simply curious, here's how it works.",
         "say": "Whether you build circuits, fund them, or you're simply curious, here's how it works."},
    ]},
    {"id": "s2", "min": 8.0, "lines": [
        {"ev": "gates", "show": "On TapeOut, a circuit is a set of NAND gates, living on X Layer.",
         "say": "On Tape Out, a circuit is a set of nand gates, living on X Layer."},
        {"ev": "cost", "show": "Every gate costs money to create, and gas every time it runs. So extra gates are a cost you keep paying!",
         "say": "Every gate costs money to create, and gas, every time it runs. So extra gates are a cost you keep paying!"},
        {"ev": "same", "show": "But a smaller circuit only helps if it gives exactly the same answers.",
         "say": "But a smaller circuit only helps, if it gives exactly the same answers."},
    ]},
    {"id": "s3", "min": 5.0, "lines": [
        {"ev": "steps", "show": "ForgeOut handles both, in three steps: optimize, prove, and tape out.",
         "say": "Forge Out handles both, in three steps: optimize, prove, and tape out."},
    ]},
    {"id": "s4", "min": 10.0, "lines": [
        {"ev": "open", "show": "Step one: optimize! Open forgeout.xyz. No install. No account.",
         "say": "Step one: optimize! Open Forge Out dot ex why zee. No install. No account."},
        {"ev": "paste", "show": "Paste your circuit, as a truth table, a Boolean expression, or a netlist.",
         "say": "Paste your circuit, as a truth table, a Boolean expression, or a netlist."},
        {"ev": "pick", "show": "Choose your goal: fewer gates, or less depth. Then press Optimize.",
         "say": "Choose your goal: fewer gates, or less depth. Then press Optimize."},
        {"ev": "result", "show": "Done! Six NAND gates, checked equivalent, with a netlist ready to download. And it all runs in your browser.",
         "say": "Done! Six nand gates, checked equivalent, with a netlist ready to download. And it all runs in your browser."},
    ]},
    {"id": "s5", "min": 10.0, "lines": [
        {"ev": "rows", "show": "Step two: prove! ForgeOut compares the new circuit with the original, on every possible input.",
         "say": "Step two: prove! Forge Out compares the new circuit with the original, on every possible input."},
        {"ev": "second", "show": "Then a second tool, written separately, with no shared code, checks the published circuits again.",
         "say": "Then a second tool, written separately, with no shared code, checks the published circuits again."},
        {"ev": "stats", "show": "22 circuits. 25,856 output bits. Zero mismatches!",
         "say": "Twenty two circuits. Twenty five thousand, eight hundred and fifty six output bits. Zero mismatches!"},
    ]},
    {"id": "s6", "min": 10.0, "lines": [
        {"ev": "replay", "show": "So, does it work? We replayed FabX's public task bank: 46 tasks with a complete spec.",
         "say": "So, does it work? We replayed Fab X's public task bank: forty six tasks with a complete spec."},
        {"ev": "bar", "show": "ForgeOut beat the reference on 22, tied 11, and lost 13.",
         "say": "Forge Out beat the reference on twenty two, tied eleven, and lost thirteen."},
        {"ev": "gc", "show": "The biggest win is task GC-012. Reference cost: 496,000. Ours: under 29,000. Seventeen times lower!",
         "say": "The biggest win is task G C twelve. Reference cost: four hundred and ninety six thousand. Ours: under twenty nine thousand. Seventeen times lower!"},
    ]},
    {"id": "s7", "min": 9.0, "lines": [
        {"ev": "gallery", "show": "Step three: tape out! Every checked circuit comes with its netlist, and ready-made calldata.",
         "say": "Step three: tape out! Every checked circuit comes with its netlist, and ready-made call data."},
        {"ev": "wallet", "show": "Copy it, and send it from your own wallet. ForgeOut never holds your keys.",
         "say": "Copy it, and send it from your own wallet. Forge Out never holds your keys."},
        {"ev": "registry", "show": "Five showcase circuits are already live on X Layer, listed in ForgeRegistry.",
         "say": "Five showcase circuits are already live on X Layer, listed in Forge Registry."},
    ]},
    {"id": "s8", "min": 9.0, "lines": [
        {"ev": "c1", "show": "Developers, there's a command line tool too. forge optimize shrinks a circuit.",
         "say": "Developers, there's a command line tool too. Forge optimize, shrinks a circuit."},
        {"ev": "c2", "show": "forge verify-onchain checks a live circuit against X Layer.",
         "say": "Forge verify on chain, checks a live circuit against X Layer."},
        {"ev": "c3", "show": "And forge calldata builds the transaction as a dry run. It never sends anything.",
         "say": "And forge call data, builds the transaction as a dry run. It never sends anything."},
    ]},
    {"id": "sc", "min": 9.0, "lines": [
        {"ev": "exp", "show": "There's even a path towards real silicon. ForgeOut exports a checked circuit as a Tiny Tapeout project.",
         "say": "There's even a path towards real silicon. Forge Out exports a checked circuit, as a Tiny Tape Out project."},
        {"ev": "ci", "show": "We ran one through Tiny Tapeout's own checks. 15 out of 15 passed, producing a 34-cell layout.",
         "say": "We ran one through Tiny Tape Out's own checks. Fifteen out of fifteen passed, producing a thirty four cell layout."},
        {"ev": "lim", "show": "To be clear: it's a tapeout-ready export. We have not ordered fabrication, and we do not claim a physical chip exists.",
         "say": "To be clear: it's a tape out ready export. We have not ordered fabrication, and we do not claim a physical chip exists."},
    ]},
    {"id": "s9", "min": 9.0, "lines": [
        {"ev": "bullets", "show": "And we're upfront about the limits. Smallest-possible is proven only up to three inputs. The reference still wins 13 tasks. And we never predict rewards.",
         "say": "And we're upfront about the limits. Smallest possible, is proven only up to three inputs. The reference still wins thirteen tasks. And we never predict rewards."},
        {"ev": "url", "show": "That's ForgeOut! Cheaper circuits, checked identical. Try it now, at forgeout.xyz.",
         "say": "That's Forge Out! Cheaper circuits, checked identical. Try it now, at Forge Out dot ex why zee."},
    ]},
]

LEAD = 0.6      # silence at the start of each scene (the transition)
GAP = 0.32      # pause between lines inside a scene
TAIL = 0.8      # pause after the last line of a scene
