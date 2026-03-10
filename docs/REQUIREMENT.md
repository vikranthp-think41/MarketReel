# Project: MarketReel — Global Film Distribution & Acquisition Agent

## Objective
Build a **MarketLogic AI system** that assists film distribution executives in evaluating independent movies for **global acquisition and theatrical release strategy**.

---

## Data Sources

The system must retrieve and analyze information from:

### 1. Local PostgreSQL Database
- Historical **global box office performance** by genre and territory  
- Actor **Q-scores** and **social media reach**  
- **Regional theatrical window trends**  
- **Currency exchange rates**  
- Existing **VOD/streaming licensing price benchmarks**

### 2. Local Documentation Files
- Unstructured **film synopses and scripts**  
- **Critical reviews and sentiment reports** from film festivals (e.g., Cannes, Sundance)  
- **Regional censorship guidelines** and **cultural sensitivity reports**  
- **Marketing campaign strategy briefs**

---

## User Interaction
Users should interact with the system using **natural language queries**.

---

## Core System Capabilities

### Territory Valuation & Pricing
Estimate the **Minimum Guarantee (MG)** for a film in specific regions (e.g., *Latin America vs. South Korea*) by cross-referencing **script themes** with **historical regional box office data**.

### Cultural & Censorship Risk Flagging
Identify potential **plot points or imagery** in the script that may trigger **censorship** or require **heavy editing**, based on unstructured **regional regulatory PDFs**.

### Festival Sentiment Synthesis
Analyze **critic reviews** to project how **awards buzz** or **negative sentiment** will quantitatively impact the **digital vs. theatrical revenue split**.

### Marketing & Release Strategy
Recommend an **optimal release window** and **marketing spend** by comparing the film’s **talent power** (from the database) with **narrative hooks identified in the script**.

### Contextual Conversation
Support strategic follow-up questions, such as:

- *"If we skip a theatrical release in France and go straight to streaming, how does the ROI change?"*  
- *"Why is this film projected to underperform in Germany despite high festival scores?"*

### Structured JSON Outputs
Generate a **distribution scorecard** including:

- Projected **revenue by territory**
- **Risk flags** for international markets
- **Recommended acquisition price**
- **Release timeline**