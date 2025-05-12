export interface EpisodeDetails {
    /**
     * The numeric id of the episode - based on order episodes were retrieved & transcribed, roughly based on publication date in the RSS feed
     */
    id: number;
    /**
     * The date of the episode in YYYY-MM-DD format - retrieved from the RSS feed, by parsing <pubDate>
     */
    date: string;
    /**
     * The title of the episode - retrieved from the RSS feed, <title>
     */
    title: string;
    /**
     * The panelists of the episode - retrieved from the RSS feed, by parsing <description>  
     * 
     * TODO: This needs to be implemented, by adding a pass over the RSS feed with an LLM, to extract the panelists
     * For now, will always be null
     */
    panelists: string[] | null;
    /**
     * The type of episode - retrieved from the RSS feed, by parsing <title> and/or <description>
     * 
     * TODO: This needs to be implemented, by adding a pass over the RSS feed with an LLM, to extract the episode type
     * For now, will always be null
     */
    episodeType: 'Adjudication Panel' | 'The Football Cliches Quiz' | 'Mesut Haaland Dicks' | 'Listener\'s Mesut Haaland Dicks' | null;
}