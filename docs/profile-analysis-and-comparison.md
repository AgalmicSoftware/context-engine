# Profile analysis and comparison

User Analysis summarizes the profile's visible answers and affiliations. Its prose describes themes, preferences and reservations rather than listing rating scores, quadratic votes or credit arithmetic. Missing or encrypted answers are not treated as neutral views.

The analysis displays the model reported by the AI provider. When a Worker omits that metadata, the label says **Requested AI model** instead. Model provenance is stored with the summary, so changing AI settings does not relabel a cached result. Older summaries without model information say **AI model: not recorded**. The updated prompt uses a new cache version; opening analysis regenerates an older-format summary through the usual authorized AI request.

Comparisons opened from a profile keep that profile's session in the comparison URL. Hosted comparisons use the session's complete question, survey and response caches; they do not wait for an unrelated chain membership cache. Switching sessions reruns the comparison using that session's visible data. Failed or stalled loading shows an error and a retry control without treating incomplete responses as ready. Chain-backed comparisons retain their existing cache and profile-scan requirements.

Selected wallets appear as compact identity pills; use the clear button to replace one. Comparison controls use the active theme: rounded pills and a teal action in Context Engine, square beveled controls in Classic 95.
