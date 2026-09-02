import React from 'react';
import { Text, View, TextStyle, ViewStyle, Platform } from 'react-native';

interface MarkdownTextProps {
  children: string;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  lightMode?: boolean;
}

interface ParsedElement {
  type: 'text' | 'bold' | 'italic' | 'code' | 'heading' | 'link' | 'unordered-list-item' | 'ordered-list-item';
  content: string;
  level?: number; // for headings
  itemNumber?: string; // for ordered list items
}

// A Paragraph is a block-level element like a heading, a list item, or an array of inline elements.
type Paragraph = ParsedElement | ParsedElement[];

const MarkdownText: React.FC<MarkdownTextProps> = ({
  children,
  style = {},
  containerStyle = {},
  lightMode = false,
}) => {
  const baseTextColor = lightMode ? '#0C3572' : '#0C3572';
  const codeBackgroundColor = lightMode ? '#F3F4F6' : '#374151';
  const codeTextColor = lightMode ? '#DC2626' : '#F87171';
  const linkColor = lightMode ? '#2563EB' : '#60A5FA';

  const parseMarkdown = (text: string): Paragraph[] => {
    const paragraphs: Paragraph[] = [];
    let currentInlineGroup: ParsedElement[] = [];

    // Pre-process to normalize line endings and paragraph breaks
    const standardizedText = text.replace(/\r\n/g, '\n').trim();
    const lines = standardizedText.split('\n');

    for (const line of lines) {
      // An empty line signifies a paragraph break
      if (line.trim() === '') {
        if (currentInlineGroup.length > 0) {
          paragraphs.push([...currentInlineGroup]);
          currentInlineGroup = [];
        }
        continue;
      }

      // Check for block-level elements (headings, list items)
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (currentInlineGroup.length > 0) {
          paragraphs.push([...currentInlineGroup]);
          currentInlineGroup = [];
        }
        paragraphs.push({
          type: 'heading',
          content: headingMatch[2],
          level: headingMatch[1].length,
        });
        continue;
      }

      const unorderedListMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
      if (unorderedListMatch) {
        if (currentInlineGroup.length > 0) {
          paragraphs.push([...currentInlineGroup]);
          currentInlineGroup = [];
        }
        // Each list item is its own paragraph for spacing purposes
        paragraphs.push({
          type: 'unordered-list-item',
          content: unorderedListMatch[1],
        });
        continue;
      }

      const orderedListMatch = line.match(/^[\s]*(\d+)\.\s+(.+)$/);
      if (orderedListMatch) {
        if (currentInlineGroup.length > 0) {
          paragraphs.push([...currentInlineGroup]);
          currentInlineGroup = [];
        }
        paragraphs.push({
          type: 'ordered-list-item',
          content: orderedListMatch[2],
          itemNumber: orderedListMatch[1],
        });
        continue;
      }

      // If it's not a block element, parse for inline elements
      const inlineElements = parseInlineMarkdown(line);
      currentInlineGroup.push(...inlineElements);
    }

    // Add any remaining inline group as the last paragraph
    if (currentInlineGroup.length > 0) {
      paragraphs.push(currentInlineGroup);
    }

    return paragraphs;
  };

  const parseInlineMarkdown = (text: string): ParsedElement[] => {
    const elements: ParsedElement[] = [];
    // Regex for bold, italic, code, and links
    const pattern = /(\*\*(.*?)\*\*)|(\*(.*?)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // Add the text before the match
      if (match.index > lastIndex) {
        elements.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }

      if (match[1]) { // Bold: **text**
        elements.push({ type: 'bold', content: match[2] });
      } else if (match[3]) { // Italic: *text*
        elements.push({ type: 'italic', content: match[4] });
      } else if (match[5]) { // Code: `text`
        elements.push({ type: 'code', content: match[6] });
      } else if (match[7]) { // Link: [text](url) - we only use the text part for now
        elements.push({ type: 'link', content: match[8] });
      }
      
      lastIndex = pattern.lastIndex;
    }

    // Add any remaining text after the last match
    if (lastIndex < text.length) {
      elements.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return elements;
  };

  const renderInlineElement = (element: ParsedElement, index: number) => {
    const key = `${element.type}-${index}`;
    switch (element.type) {
      case 'bold':
        return <Text key={key} style={{ fontWeight: 'bold' }}>{element.content}</Text>;
      case 'italic':
        return <Text key={key} style={{ fontStyle: 'italic' }}>{element.content}</Text>;
      case 'code':
        return (
          <Text key={key} style={{
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            backgroundColor: codeBackgroundColor,
            color: codeTextColor,
            borderRadius: 4,
            paddingHorizontal: 5,
            paddingVertical: 2,
          }}>{element.content}</Text>
        );
      case 'link':
        return <Text key={key} style={{ color: linkColor, textDecorationLine: 'underline' }}>{element.content}</Text>;
      case 'text':
      default:
        return <Text key={key}>{element.content}</Text>;
    }
  };

  const renderParagraph = (paragraph: Paragraph, index: number) => {
    const key = `p-${index}`;
    // Paragraph spacing. Adjust `marginBottom` as needed.
    const paragraphStyle: ViewStyle = { marginBottom: 8 };

    if (Array.isArray(paragraph)) {
      // This is a standard paragraph with inline elements
      return (
        <Text key={key} style={[style, { color: baseTextColor }, paragraphStyle]}>
          {paragraph.map(renderInlineElement)}
        </Text>
      );
    }

    // This is a block-level element (heading, list item)
    switch (paragraph.type) {
      case 'heading':
        const headingSize = Math.max(20 - (paragraph.level || 1) * 1.5, 14);
        return (
          <Text key={key} style={[style, {
            color: baseTextColor,
            fontSize: headingSize,
            fontWeight: 'bold',
            marginBottom: 6, // Different margin for headings
          }]}>
            {paragraph.content}
          </Text>
        );
      case 'unordered-list-item':
        return (
          <View key={key} style={{ flexDirection: 'row', marginBottom: 3 }}>
            <Text style={[style, { color: baseTextColor, marginRight: 8 }]}>•</Text>
            <Text style={[style, { color: baseTextColor, flex: 1 }]}>
              {parseInlineMarkdown(paragraph.content).map(renderInlineElement)}
            </Text>
          </View>
        );
      case 'ordered-list-item':
        return (
          <View key={key} style={{ flexDirection: 'row', marginBottom: 3 }}>
            <Text style={[style, { color: baseTextColor, marginRight: 8 }]}>{paragraph.itemNumber}.</Text>
            <Text style={[style, { color: baseTextColor, flex: 1 }]}>
              {parseInlineMarkdown(paragraph.content).map(renderInlineElement)}
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  const paragraphs = parseMarkdown(children);

  return (
    <View style={containerStyle}>
      {paragraphs.map(renderParagraph)}
    </View>
  );
};

export default MarkdownText;