import React, { useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { splitTextWithMentions } from '@/lib/parseCaptionMentions';

type CommentContentTextProps = {
  content: string;
  style?: StyleProp<TextStyle>;
};

export function CommentContentText({ content, style }: CommentContentTextProps) {
  const router = useRouter();
  const segments = useMemo(() => splitTextWithMentions(content), [content]);

  return (
    <Text style={[styles.body, style]} selectable>
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          <Text key={i} style={styles.body}>
            {seg.text}
          </Text>
        ) : (
          <Text
            key={i}
            style={styles.mention}
            onPress={() =>
              router.push({
                pathname: '/search',
                params: { q: `@${seg.username}` },
              })
            }
            accessibilityRole="link"
            accessibilityLabel={`View @${seg.username}`}
          >
            @{seg.username}
          </Text>
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  body: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  mention: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
  },
});
