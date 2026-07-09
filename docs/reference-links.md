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

### Argument Technology
- **URL:** https://en.wikipedia.org/wiki/Argument_technology
- **Summary:** The field of computational tools for structured argumentation, debate mapping, and collective reasoning. Encompasses argument mining, dialogue systems, and visualization of reasoning structures.
- **Relevance:** Context Engine's survey/response system is a form of structured opinion capture. Argument technology frameworks (argument maps, inference schemes, dialogue protocols) could inform future features like threaded debate views, structured rebuttals, or AI-assisted argument summarization. Related projects: Kialo, Debategraph, ARG:mine/AIFdb.

### Red Dwarf (Polis Community)
- **URL:** https://github.com/polis-community/red-dwarf/tree/main/
- **Summary:** Python library that reproduces Polis-like participatory democracy pipelines — loads voting data, applies dimensionality reduction (PCA, PaCMAP) and clustering (K-means, HDBSCAN) to identify opinion groups. Built on scikit-learn.
- **Relevance:** Direct reference implementation for the Polis math that Context Engine's `polisMath.ts` implements. Useful for validating our clustering, comparing algorithms, or porting improved techniques.
