export const SEARCH_FACETS = [
    {
        facetId: 'episodeType',
        label: 'Episode Type',
        options: [
            {
                value: 'adjudication',
                label: 'Adjudication Panel'
            },
            {
                value: 'quiz',
                label: 'Football Cliches Quiz'
            },
            {
                value: 'mesut-haaland-dicks-listener',
                label: 'Mesut Haaland Dicks - Listener'
            },
            {
                value: 'mesut-haaland-dicks-guest',
                label: 'Mesut Haaland Dicks - Guest'
            },
            {
                value: 'best-of',
                label: 'Best Of'
            },
            {
                value: 'general',
                label: 'General'
            }
        ]
    },
    {
        facetId: 'panelists',
        label: 'Panelists',
        options: [
            {
                value: 'adam-hurrey',
                label: 'Adam Hurrey',
                additionalDetails: {
                    profilePictureFileName: 'adam-hurrey.jpg'
                }
            },
            {
                value: 'adam-leventhal',
                label: 'Adam Leventhal'
            },
            {
                value: 'charlie-eccleshare',
                label: 'Charlie Eccleshare'
            },
        ]
    }
] as const;