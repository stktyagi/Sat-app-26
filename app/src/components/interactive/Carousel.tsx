import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, Dimensions, TouchableOpacity, Text } from 'react-native';

interface CarouselItem {
  id: string;
  [key: string]: any;
}

interface CarouselProps {
  data: CarouselItem[];
  renderItem: ({ item, index }: { item: CarouselItem; index: number }) => React.ReactNode;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showDots?: boolean;
  showArrows?: boolean;
  itemWidth?: number;
  spacing?: number;
  className?: string;
}

const Carousel: React.FC<CarouselProps> = ({
  data,
  renderItem,
  autoPlay = false,
  autoPlayInterval = 3000,
  showDots = true,
  showArrows = false,
  itemWidth,
  spacing = 16,
  className = ''
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;
  const slideWidth = itemWidth || screenWidth - 32; // Default with padding

  useEffect(() => {
    if (autoPlay && data.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % data.length;
          scrollToIndex(nextIndex);
          return nextIndex;
        });
      }, autoPlayInterval);

      return () => clearInterval(interval);
    }
  }, [autoPlay, autoPlayInterval, data.length]);

  const scrollToIndex = (index: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * (slideWidth + spacing),
        animated: true,
      });
    }
  };

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / (slideWidth + spacing));
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    const prevIndex = currentIndex === 0 ? data.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    scrollToIndex(prevIndex);
  };

  const goToNext = () => {
    const nextIndex = (currentIndex + 1) % data.length;
    setCurrentIndex(nextIndex);
    scrollToIndex(nextIndex);
  };

  return (
    <View className={className}>
      <View className="relative">
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled={!itemWidth}
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={itemWidth ? slideWidth + spacing : undefined}
          snapToAlignment="center"
          contentContainerStyle={{
            paddingHorizontal: itemWidth ? 16 : 0,
          }}
        >
          {data.map((item, index) => (
            <View
              key={item.id}
              style={{
                width: slideWidth,
                marginRight: index < data.length - 1 ? spacing : 0,
              }}
            >
              {renderItem({ item, index })}
            </View>
          ))}
          <View className="w-8"></View>
        </ScrollView>

        {/* Navigation Arrows */}
        {showArrows && data.length > 1 && (
          <>
            <TouchableOpacity
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 rounded-full w-10 h-10 items-center justify-center"
              onPress={goToPrevious}
            >
              <Text className="text-white text-lg">←</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 rounded-full w-10 h-10 items-center justify-center"
              onPress={goToNext}
            >
              <Text className="text-white text-lg">→</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Dots Indicator */}
      {showDots && data.length > 1 && (
        <View className="flex-row justify-center mt-[8px] items-center gap-4">
          {data.map((item, index) => (
            <TouchableOpacity
              key={`dot-${item.id}-${index}`}
              className={`w-2 h-2 rounded-full ${
                index === currentIndex ? 'bg-white border-[1px] border-[#0C3572]' : 'bg-[#0C3572]'
              }`}
              onPress={() => {
                setCurrentIndex(index);
                scrollToIndex(index);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export default Carousel;