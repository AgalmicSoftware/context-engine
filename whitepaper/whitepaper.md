# Context Engine

## Social Infrastructure for the AI Transition & A Toolkit for Group Coordination

*v0.1.0 (2026) — agalmic.eth*

For technical documentation, see [`spec.md`](../spec.md) and [`docs/`](../docs/README.md).

---

keywords: sensemaking, deliberation, collective intelligence, discourse, debate, ethereum, coasean bargaining, cryptography, programmable cryptography, decentralized networks, agi, social infrastructure, ai policy, community currencies, coordination, negotiation, voting, democracy, zk, homomorphic encryption

---

## Abstract

The pace of AI development has exceeded the capacity of democratic and civic institutions to deliberate in a timely and coherent way. This is partially an infrastructure problem: we lack formats and interfaces for large-scale discourse, debate, and negotiation that can withstand information overwhelm and attention scarcity.

Context Engine is an open-source toolkit enabling groups to create digital artifacts representing their preferences, beliefs, and points of agreement or disagreement over time. The approach can apply within and between groups, pointing to a future of collective intelligence via automated coordination and productive conflict – stemming from durable context and quantifiable preference data. The toolkit represents an extension on current SOTA large-group discourse software by leveraging cryptography (for private sessions and content), AI (for input UX and result interpretation), and decentralized protocols (for censorship-resistance and data permanence). A corresponding local version for use within organizations is planned.

These tools are meant to be useful wherever groups coordinate and make decisions, from hyper-local to international settings. For companies and organizations, they facilitate the recording and incentivizing of predictions in a privacy-preserving way. For digital groups, a path is visible towards training AI models that represent shared interests to outsiders or other groups, while distilling and (optionally) monetizing preference data in an attributable way, with future access to continuous training data revocable under defined terms. In our cities these tools may help us identify shared priorities and reverse polarization, and it is our hope that they will ultimately help us define (in multimedia formats) AI futures to aim for and avoid.

---

## 1. Problem

Public AI discourse is often low-dimensional and reduced to competing slogans, such as "accelerate" vs "pause", while more useful debates – involving AI's impact on the economy, health, education, environment, warfare, and politics – are inadequately addressed by mainstream media and existing social media. There is a lack of productive conflict which might help us navigate towards better equilibriums as a society. This deficit increases the odds of subpar and/or rushed decisions in the future, some of which may prove difficult or impossible to reverse.

High-quality content on AI policy issues exists, but often in long-form formats that regular people don't have the time or capacity to engage with – even though everyone on earth will be affected by AI decisions.

We don't yet have a time-efficient and intuitive "map" of AI questions, which allows leaders (in industry and government) to under-specify their positions and avoid public commitments. A step towards addressing this would be a simple toolkit to record views, preferences, and predictions on AI topics, such that responses:

- Can be public and/or encrypted (for trusted groups and/or future evaluation) as appropriate
- Are stored permanently, in a standard format AI can summarize / aggregate / evaluate / operate on
- Can be filtered / encrypted by attestations, proof-of-human credentials, and/or SBTs (non-transferrable tokens; RadicalxChange Foundation, n.d.-a) issued by disparate communities

This infrastructure would act as a stepping stone towards a more compelling interface which allows us to visualize (in multimedia formats) futures that we want to aim for and avoid, to explore positive and negative scenarios via large-scale group prompting, and to judge whether these scenarios follow from present-day policy proposals.

To the extent that this approach is useful for AI policy debate, it could also apply to policy debate at smaller scales and within various organizations.

## 2. Building on Existing Tools

The current SOTA for this type of large-group discourse software is Pol.is, which showed through vTaiwan (g0v, 2014; Computational Democracy Project, n.d.) that debate in large groups can be improved by collecting and analyzing simple Agree / Unsure / Disagree responses, clarifying areas of both consensus and difference.

Context Engine extends the pioneering approach of Pol.is in the following ways:

- More question types (binary, freeform, multichoice, rating) + priority / conviction ratings
- Optional privacy of responses / votes / results / shared group context
- AI-native inputs / outputs for better UX: Generate questions / responses from URLs, speech-to-text input, AI analysis of results
- Permanent and Public Data Storage by default (private and temporary options also possible)
- Passkey Ethereum Wallet account model (vs email): Natively allows use of cryptography, proof-of-human, digital group membership tokens
- No-Code deployment of new sessions: compatible with other tools / easy .json export

Although Context Engine is an Ethereum application, users do not need to know anything about cryptocurrency to use it

## 3. What Context Engine is Today

Context Engine is a web application, a set of smart contracts (EVM), and supporting infrastructure for AI inference, storage, access gating, and encryption. It is meant to be easily redeployable by various groups with no programming experience.

- **Sessions** include questions, responses, documents, access gates, and configuration, and new Sessions  can be created from the web application (at [/new](https://contextengine.sh/new)).
- **Surveys and Questions** supports binary, rating, multiple-choice, and freeform questions (with the ability to add new question types as needed), with optional conviction weighting and comments.
- **Access control** uses soulbound tokens (non-transferrable NFTs), with support for gated participation, encrypted fields, and sponsored resources (RPC, AI, EVM tx Costs, Arweave Storage, Lit Encryption).
- **Storage**: responses and documents stored on Arweave
- **AI** is already used for question generation, transcription, cluster summaries, result analysis, and comparison of user positions across wallets.
- **Demonstration datasets** are shipped in the repo as well, including one built around simulated historical figures. The current public demo can be seen at [/demo-1](https://contextengine.sh/session/demo-1)

The same product can also be deployed more privately and scalably (as circumstances demand), with local storage, POA blockchain, local encryption backends, and self-hosted workers when data cannot leave an organization.

### Session Capacity and Scaling

A session is currently expected to support hundreds to low thousands of concurrent participants. For larger-scale deployments, batched or async settlement, private PoA chains, read-path caching, and application-specific rollups are directions to explore — each step increasing throughput by one to two orders of magnitude. See [`docs/scaling.md`](../docs/scaling.md).


## 4. Use Cases Beyond AI Discourse


### Companies and Organizations

Many organizations could benefit from a more comprehensive record of what people believed before decisions (outcomes, timelines, risks, confidence), which tradeoffs they understood at the time, and who was consistently well-calibrated. This approach would also allow organizations to understand where assumptions diverge before decisions are taken.

Context Engine sessions let teams record predictions, assumptions, and confidence before outcomes are known. Entries are timestamped, immutable, and (optionally) encrypted until a chosen date or condition, reducing social pressure at input time and making later review more objective.

Those with strong predictive ability may be incentivized and their predictions (on relevant topics) weighed more heavily in future decisions (potentially in a privacy-preserving way). These ideas point to a future of incentive-compatible job automation, where employees retain control of the data / model representing their tacit knowledge and intuition, and can provide this model to the relevant organization under negotiated terms.

Organizations can run a local version of the decentralized stack described above — using local storage, private POA chains, and self-hosted workers — so that sensitive data does not leave the organization.

### Digital Communities

Many online communities have norms, values, and tacit knowledge in forms that cannot be easily read by outsiders and/or AI systems: chat logs, moderation histories, ongoing discussions, and informal relationships.

Not every group should aim to formalize itself for outside interaction, but those which generate value through traffic, attention, and interpretation could begin to retain ownership over the data and value they create (RadicalxChange Foundation, n.d.-b; Posner & Weyl, 2018).

Context Engine points towards several directions:

- **Preference codification** — views on norms, strategy, governance, aesthetics, and external events in a format that remains queryable over time
- **Representative AI models** — accumulated response data can train models that represent the group's actual distribution of views, participate in negotiations with other groups, or respond to external queries
- **Data sovereignty** — aggregated preference data attributed at the wallet level and licensable to model providers under explicit terms. Local and tacit knowledge can be priced differently depending on who is asking
- **Content curation** — Reactions to content from other websites (rather than simple questions) could help establish a grassroots trust layer for content, where moderation / scoring is accomplished by a Community Notes style algorithm (within and between groups)
- **New advertisements** – Groups could be the target of personalized (and privacy-preserving) ads, where the revenue is split among members or funds a shared group treasury

In this context, "revocable" means the group can stop ongoing access: disabling API access, ending future continuous-training feeds, rotating encryption keys for newly produced or still-held data, and terminating contract rights after a violation. It does not mean that data already copied into a provider's model can be technically removed. Undoing past training would require legal remedies, provider cooperation, or machine-unlearning techniques that remain research-stage.

Quantified measures of group membership, attention, and exchange are a related direction, especially work on community currencies and attention (see PCARE; Ohlhaver, 2025). Recent open-source Mixture-of-Experts architectures overlap with this vision of community-owned models, involving the training, governing, and licensing of separable parts of a model (see FlexOlmo; Shi et al., 2025).

### Events and Conferences

Live events generate high-bandwidth discussions which often don't persist or survive in any records – even events which record presentations have no way of capturing resulting discussions, and this valuable data is left to be remembered or forgotten by participants.

Conferences, retreats, and pop-up events could instead produce a map of its opinion space, allowing viewers (public or participants only) to see which ideas had broad support, which were polarizing, how different sub-groups responded (filtered by SBTs).

Recurring or related communities can add or reference the same map, compare changes over time, and build continuity between gatherings instead of starting over each cycle. Such maps would not only be useful after an event, but also before and during – helping to steer discourse towards the most productive or interesting areas, and creating raw material which can later be rendered as compelling multimedia artifacts. This deliberation data could also be used for AI training and/or generate revenue for the event or group by making this conditionally available to outside viewers.

#### A note on "Groups"

Groups are not only formal organizations or informal pre-existing communities. With zkTLS proofs, a group can be defined by any shared attribute or verifiable condition: web activity, student status, demographics, attendance of an event, shared beliefs, media consumption, purchase history, financial proofs, and more.

This relates to the Plurality view that individuals are intersections of many groups. Programmable cryptography makes these group definitions expressible in code, and future versions of this toolkit will allow people to prove membership in one group without exposing every other affiliation.


### Cities and Public Institutions

In some science fiction stories, it is possible for inhabitants to talk directly to a city. We now have the technical foundation to move in that direction, and early deployments in places such as Bowling Green, Kentucky, suggest there is demand for city-scale discourse and priority setting (Jigsaw, n.d.). Recent "broad listening" experiments in electoral settings, including the Tokyo governor race, also point in this direction (Henderson, 2025).

A standing session accumulates input between formal decision points: more nuanced than a poll, more durable than a hearing (and easier to attend). Views can be filtered by community-issued attestations, or by privacy-preserving "proof of ZIP," so officials can see how different constituencies respond to the same questions without violating privacy. AI summarization makes large response sets legible without discarding the underlying record.

## 5. Future Directions

The roadmap is best understood as several related directions rather than a single linear feature list.

### Privacy, Credentials, and Safety

- **Stronger privacy** — unlinkable per-response and per-SBT accounts, zero-knowledge and FHE aggregation, and proofs on properties of encrypted responses.
- **zkTLS group formation** — privacy-preserving groups based on age, occupation, location, interests, web and real-world activity, shared incentives, and other verifiable attributes.
- **AI whistleblowing toolkit** — prove a relevant affiliation, such as control of an organizational email address, then make claims that can be public, encrypted, or conditionally time-locked.
- **Post-quantum cryptography** — transition relevant cryptographic functionality to post-quantum primitives as libraries and standards mature.

### Deployment and Resilience

- **Walkaway resilience** — host the front end on an ENS (.eth) domain and explore core services as AVSs (EigenLayer, n.d.).
- **More storage options** — add IPFS for larger or optionally ephemeral files, plus centralized storage options that can be configured per session.
- **Turnkey deployment** — make it possible to purchase the required bundle of credits and API keys, including Arweave storage, Lit encryption, EVM gas, and AI API access, with stablecoins in a trust-minimized way.

### Interfaces and Inputs

- **Agent-first UX** — let users point OpenClaw or similar agents at a session and interact through natural language.
- **Voice-only mode** — support multilingual interaction through voice commands.
- **Better document and context integration** — add document-grounded analysis, AI-generated knowledge maps, more fluid movement between discussion, clustering, and synthesis, and more advanced versions of the Debate Tree interface.

### Preference Data and Models

- **Group-representative AI models** — train models that represent group preferences, earn revenue from approved invocations, and sell ongoing access to preference updates, special knowledge, and attention under revocable future-access terms.
- **Preference weighting** — rank questions and priorities, and explore weighted delegation to historical or contemporary figures in automated debate.

### Deliberation and Negotiation

- **Group prompting and backcasting** — convert result clusters into scenarios groups are trying to aim for or avoid, render them as interactive media, and connect those scenarios back to present-day policy choices.
- **Agent-to-agent negotiation tooling** — support multi-step negotiation processes involving private information.

- **AI Whistleblowing Toolkit**: prove you have @aiLab.com email address using ZK → Make claims (potentially encrypted or conditionally timelocked)

- **Post-quantum Cryptography**: Transition cryptographic functionalities to post-quantum versions


## 6. Closing Thoughts

Context Engine represents a step toward a world of automated debate and coalition building, as well as large-scale Coasean bargaining (Krier, 2025). It is our belief that the world needs better interfaces for negotiation, preference discovery, and coordination between and within groups.

A longer-term goal is cryptographic diplomacy: incentive-compatible programmatic treaties, enforced by an incorruptible arbiter (Griffith, 2019). In that setting, policy commitments, monitoring rights, and negotiated constraints could be specified and audited with less reliance on unverifiable trust.

Programmable cryptography seems like an underexplored toolkit for AI safety and alignment efforts (0xPARC, 2023). Storytelling is another area that seems underexplored in current AI alignment efforts – Context Engine is intended to help various groups define, debate, and analyze visions of possible futures, and connect them directly to present-day choices.

Context Engine recognizes and builds on the pioneering work of those involved with RadicalxChange, Pol.is, vTaiwan, g0v, TalkToTheCity, Loophole, the Plurality Book, 0xPARC, Zuzalu, Edge City, MetaGov, PCARE, and many other related efforts. The author also gratefully acknowledges the AI programming assistance that finally made this effort tractable.


## References

0xPARC. (2023). "Programmable Cryptography (Part 1)." *0xPARC.* https://0xparc.org/writings/programmable-cryptography-1

Computational Democracy Project. (n.d.). *Polis.* https://compdemocracy.org/polis/

EigenLayer. (n.d.). "AVS Developer Guide." *EigenLayer Docs.* https://docs.eigencloud.xyz/eigenlayer/developers/concepts/avs-developer-guide

g0v. (2014). *vTaiwan: An Open Consultation Process for National Issues.* https://info.vtaiwan.tw/

Griffin, C. (2024, May 30). "The AI Policy Atlas." *AI Policy Perspectives.* https://www.aipolicyperspectives.com/p/the-ai-policy-atlas

Griffith, V. (2019, April 8). "Ethereum is game-changing technology, literally." *Medium.* https://medium.com/@virgilgr/ethereum-is-game-changing-technology-literally-d67e01a01cf8

Henderson, J. (2025, February 7). "The Art of Broad Listening." *Combinations.* https://www.combinationsmag.com/the-art-of-broad-listening/

Hogan, B. (n.d.). *Loophole: AI Policy Loophole Finder.* GitHub. https://github.com/brendanhogan/loophole

Jigsaw. (n.d.). "Reimagining the Town Hall Meeting." *Jigsaw.* https://jigsaw.google/our-work/reimagining-the-town-hall-meeting/

Krier, S. (2025). "Coasean Bargaining at Scale." *Cosmos Institute.* https://blog.cosmos-institute.org/p/coasean-bargaining-at-scale

Ohlhaver, P. (2025, January 2). *Community Currencies: The Price Of Attention And Cost Of Influence In A Networked Age -or- The Price Of Entry And Cost Of Exit In A Networked Age.* SSRN. https://doi.org/10.2139/ssrn.5136037

RadicalxChange Foundation. (n.d.-a). "Social Identity." *RadicalxChange Wiki.* https://www.radicalxchange.org/wiki/social-identity/

RadicalxChange Foundation. (n.d.-a). "Social Identity." *RadicalxChange Wiki.* https://www.radicalxchange.org/wiki/social-identity/

RadicalxChange Foundation. (n.d.-b). "Data Dignity." *RadicalxChange Wiki.* https://www.radicalxchange.org/wiki/data-dignity/

Owocki, K. (2026, March 5). "Collective Intelligence Infrastructure: Protocols for Thinking Together." *Gitcoin.* https://gitcoin.co/research/collective-intelligence-protocols-for-thinking-together

Ohlhaver, P., Weyl, E. G., & Buterin, V. (2022, May 10). *Decentralized Society: Finding Web3's Soul.* SSRN. https://doi.org/10.2139/ssrn.4105763

Shi, W., Bhagia, A., Farhat, K., Muennighoff, N., Walsh, P., Morrison, J., Schwenk, D., Longpre, S., Poznanski, J., Ettinger, A., Liu, D., Li, M., Groeneveld, D., Lewis, M., Yih, W., Soldaini, L., Lo, K., Smith, N. A., Zettlemoyer, L., Koh, P. W., Hajishirzi, H., Farhadi, A., & Min, S. (2025). "FlexOlmo: Open Language Models for Flexible Data Use." *arXiv:2507.07024.* https://arxiv.org/abs/2507.07024

Weyl, E. G., Tang, A., & the Plurality Community. (2023). *Plurality: The Future of Collaborative Technology and Democracy.* GitHub. https://github.com/pluralitybook/plurality/blob/main/contents/english

## Recommended Reading

Buterin, V. (2023, November 27). "My techno-optimism." *vitalik.eth.limo.* https://vitalik.eth.limo/general/2023/11/27/techno_optimism.html

Buterin, V., Hitzig, Z., & Weyl, E. G. (2019). "A Flexible Design for Funding Public Goods." *Management Science*, 65(11), 5171-5187. https://doi.org/10.1287/mnsc.2019.3337

Griffin, C. (2024, May 30). "The AI Policy Atlas." *AI Policy Perspectives.* https://www.aipolicyperspectives.com/p/the-ai-policy-atlas

Huang, S., Carter, S., Eaton, J., Pollack, S., Callender, D., III, Makagiansar, N., Gonzalez, M., Carr, S., Hong, J., Handa, K., McCain, M., Millar, T., Julapalli, M., Yun, G., Alt, A. J., Larsson, C., Leibrock, J., Gallivan, M., Sumers, T., Durmus, E., Kearney, M., Shen, J. H., Clark, J., Stern, M., & Ganguli, D. (2026, March 18). "What 81,000 People Want from AI." *Anthropic.* https://anthropic.com/features/81k-interviews

Ohlhaver, P., Weyl, E. G., & Buterin, V. (2022, May 10). *Decentralized Society: Finding Web3's Soul.* SSRN. https://doi.org/10.2139/ssrn.4105763

Owocki, K. (2026, March 5). "Collective Intelligence Infrastructure: Protocols for Thinking Together." *Gitcoin.* https://gitcoin.co/research/collective-intelligence-protocols-for-thinking-together

Posner, E. A., & Weyl, E. G. (2018). *Radical Markets: Uprooting Capitalism and Democracy for a Just Society.* Princeton University Press.

## Keywords

sensemaking, deliberation, collective intelligence, discourse, debate, ethereum, coasean bargaining, cryptography, programmable cryptography, decentralized networks, agi, social infrastructure, ai policy, community currencies, coordination, negotiation, voting, democracy, zk, homomorphic encryption

---

*Context Engine is open-source software. Code, documentation, and participation: [contextengine.sh](https://contextengine.sh)*
