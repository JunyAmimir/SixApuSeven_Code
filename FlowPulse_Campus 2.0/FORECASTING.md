# Local forecasting and dispatch support

No API key or camera is required. Staff can enter manual queue observations and use the Insights workspace.

The model projects a fresh queue (15 minutes or less) using observed net growth for up to one hour, carries unserved people across departures, and uses the median of matching weekday/time historical counts. Each historical day receives one vote. Reservations form a minimum and are never added to the observed queue, avoiding double counting.

Insights shows the evidence, data sources, observation count, historical days, a planning band, and dispatch reasoning. The band is a heuristic, not a calibrated confidence interval. Demo data is labeled and cannot establish real accuracy. An empty dataset means unknown demand, not an empty stop. Manual readings work without Gemini.

Dispatch advice accounts for confirmed seats, active requests and the five-minute cutoff. Staff review and confirm each request; the driver must accept before capacity increases. No automatic dispatch or external AI service is used.

Use Forecast data & accuracy to check rolling ten-minute queue forecasts against actual recorded observations and the last-count baseline. This measures queue-count error, not bus arrival accuracy or causal waiting-time savings. Collect several days of real observations before making accuracy claims.
