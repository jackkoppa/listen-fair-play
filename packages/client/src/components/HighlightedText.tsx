import { Highlight } from '@orama/highlight'

export interface HighlightedTextProps {
    text: string;
    searchStringToHighlight: string;
}

export default function HighlightedText({
    text,
    searchStringToHighlight
}: HighlightedTextProps) {
    const highlighter = new Highlight();

    const highlightedText = highlighter.highlight(text, searchStringToHighlight);
    return (
        // Requires trusting `@orama/highlight` to perform safe HTML rendering
        // https://github.com/oramasearch/highlight
        <div
            dangerouslySetInnerHTML={{ __html: highlightedText.HTML }}
        />
    )
} 