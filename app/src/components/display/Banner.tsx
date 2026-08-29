// src/components/display/EmptyState.tsx
import React, { ReactNode } from 'react';
import { View, Text, Image } from 'react-native';
// import Button from '../ui/Button';
import Button from '../ui/Button';


interface BannerProps {
    bannerId: string
    imageUrl: any // require(...) result for RN
    link: string
    title: string
    isActive: boolean
    priority: number
    id?: string // Optional for carousel compatibility
}

function fixDomain(url: string) {
  // replace https://saturnalia.ce83aab07d9a2dfff9ae6c6f9f6754d2.r2.cloudflarestorage.com with https://itsakarsh.tech/
  return url.replace(
    "https://saturnalia.ce83aab07d9a2dfff9ae6c6f9f6754d2.r2.cloudflarestorage.com",
    "https://itsakarsh.tech"
  );
}

const Banner: React.FC<{ banner: BannerProps, onPress: (targetUrl: string) => void }> = ({ banner, onPress }) => {
    if (!banner.isActive) return null;
    
    const isLocal = typeof banner.imageUrl === 'number';
    const ImageUrl = (!isLocal && banner.imageUrl?.uri) ? fixDomain(banner.imageUrl.uri) : '';
    
    return (
        <View className="ml-4 w-full h-[180px] rounded-lg overflow-hidden mb-4">
            <Button onPress={() => onPress(banner.link)} variant='Banner' size='custom' className="w-[95%] p-0 h-full mx-auto rounded-lg border-0 overflow-hidden bg-transparent">
                <Image
                    source={
                        isLocal
                            ? banner.imageUrl
                            : { uri: ImageUrl }
                    }
                    className="h-full w-full"
                    resizeMode="cover"
                />
            </Button>
        </View>
    );
}


export default Banner;

