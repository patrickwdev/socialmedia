import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  Alert,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Colors } from '@/constants/Colors';

const PROFILE_LINK_PREFIX_CHARS = 32;

type ProfileLinkDisplayProps = {
  displayUrl: string;
  normalizedHref: string;
  icon: React.ReactNode;
  rowStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  seeMoreStyle?: StyleProp<TextStyle>;
};

export function ProfileLinkDisplay({
  displayUrl,
  normalizedHref,
  icon,
  rowStyle,
  textStyle,
  seeMoreStyle,
}: ProfileLinkDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = displayUrl.length > PROFILE_LINK_PREFIX_CHARS;
  const preview = isLong ? `${displayUrl.slice(0, PROFILE_LINK_PREFIX_CHARS)}…` : displayUrl;

  const openLink = async () => {
    try {
      const supported = await Linking.canOpenURL(normalizedHref);
      if (supported) {
        await Linking.openURL(normalizedHref);
      } else {
        Alert.alert('Invalid link', 'This link cannot be opened.');
      }
    } catch {
      Alert.alert('Error', 'Could not open link.');
    }
  };

  return (
    <View style={[styles.row, rowStyle]}>
      {icon}
      <View style={styles.textWrap}>
        <Pressable onPress={openLink} style={styles.urlPress}>
          <Text style={textStyle}>{expanded ? displayUrl : preview}</Text>
        </Pressable>
        {isLong ? (
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8} style={styles.seeMoreHit}>
            <Text style={[styles.seeMore, seeMoreStyle]}>{expanded ? 'See less' : 'See more'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minWidth: 0,
  },
  urlPress: {
    flexShrink: 1,
    minWidth: 0,
  },
  seeMoreHit: {
    marginLeft: 8,
  },
  seeMore: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
