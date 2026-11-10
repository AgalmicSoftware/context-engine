# Reference Links

Research papers, specifications, and resources that may be useful for future features.

---

## Cryptography

### Threshold Encryption with Silent Setup
- **URL:** https://eprint.iacr.org/2024/263
- **Authors:** Sanjam Garg, Dimitris Kolonelos, Guru-Vamsi Policharla, Mingyuan Wang
- **Summary:** A threshold encryption scheme where the joint public key is computed as a deterministic function of locally-generated public keys, eliminating interactive setup. Supports asynchronous operation and dynamic thresholds with practical efficiency.
- **Relevance:** Could replace or supplement Lit Protocol for SBT-gated encryption — participants derive a shared public key without coordination, enabling simpler key management for encrypted survey responses and gated content.

---

## Deliberation & Argumentation

### Polis Math (Official Maintained Source)
- **URL:** https://github.com/compdemocracy/polis/tree/5089c6bef9eb1a1e454beb34354fb29dd0a2b6f0/math
- **Summary:** Maintained Clojure math worker for PCA, opinion-group clustering, representative comments, group vote tallies, and consensus summaries. The revision is pinned to the source used for Context Engine's 2026-08-29 parity audit.
- **Relevance:** Canonical behavioral reference for Context Engine's deterministic snapshot implementation. See [`polis-math-parity.md`](polis-math-parity.md) for supported parity and deliberate scope boundaries.

### polisMath (Historical Standalone Source)
- **URL:** https://github.com/pol-is/polisMath/tree/dfe233e8c9207c2ce11e1379286ad0cf0f732067
- **Summary:** Historical standalone repository later absorbed into the maintained Polis monorepo.
- **Relevance:** Useful for identifying the original cold PCA, clustering, and repness semantics separately from later worker-state fixes.

### Argument Technology
- **URL:** https://en.wikipedia.org/wiki/Argument_technology
- **Summary:** The field of computational tools for structured argumentation, debate mapping, and collective reasoning. Encompasses argument mining, dialogue systems, and visualization of reasoning structures.
- **Relevance:** Context Engine's survey/response system is a form of structured opinion capture. Argument technology frameworks (argument maps, inference schemes, dialogue protocols) could inform future features like threaded debate views, structured rebuttals, or AI-assisted argument summarization. Related projects: Kialo, Debategraph, ARG:mine/AIFdb.

### Red Dwarf (Polis Community)
- **URL:** https://github.com/polis-community/red-dwarf/tree/main/
- **Summary:** Python library that reproduces Polis-like participatory democracy pipelines — loads voting data, applies dimensionality reduction (PCA, PaCMAP) and clustering (K-means, HDBSCAN) to identify opinion groups. Built on scikit-learn.
- **Relevance:** Alternative community implementation useful for comparing modern dimensionality-reduction and clustering choices; it is not the canonical source for Context Engine parity.
