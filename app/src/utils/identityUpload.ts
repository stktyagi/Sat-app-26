import * as ImagePicker from 'expo-image-picker';
import { showAlert } from '@/components';
import { uploadProfilePhoto, uploadCollegeId } from '@/api/auth';
import { useUserStore } from '@/state/userStore';
import type { UserProfile } from '@/types/models';

/**
 * Checks if the user is considered an outside (non-host) college student.
 * Host students (e.g. Thapar students) and admins are exempt from identity requirements.
 */
export function isOutsideCollegeStudent(user?: UserProfile | null): boolean {
  if (!user) return false;
  if (user.roles?.includes('admin')) return false;

  const isHost = Boolean(
    user.isHostCollegeStudent ||
    user.collegeName?.toLowerCase().includes('thapar') ||
    user.email?.toLowerCase().endsWith('@thapar.edu')
  );

  return !isHost;
}

/**
 * Determines whether the user has satisfied all identity verification requirements.
 * For outside college students, both profile photo and college ID card are mandatory.
 */
export function isIdentityVerificationComplete(user?: UserProfile | null): boolean {
  if (!isOutsideCollegeStudent(user)) {
    return true;
  }

  const hasPhoto = Boolean(user?.photoUrl || user?.photoURL);
  const hasCollegeId = Boolean(user?.collegeIdUrl);

  return hasPhoto && hasCollegeId;
}

/**
 * Returns an array of human-readable missing identity requirements.
 */
export function getMissingIdentityRequirements(user?: UserProfile | null): string[] {
  if (!isOutsideCollegeStudent(user)) {
    return [];
  }

  const missing: string[] = [];
  const hasPhoto = Boolean(user?.photoUrl || user?.photoURL);
  const hasCollegeId = Boolean(user?.collegeIdUrl);

  if (!hasPhoto) missing.push('Profile Photo');
  if (!hasCollegeId) missing.push('College ID Card');

  return missing;
}

/**
 * Prompts the user to choose Camera or Gallery, then uploads the selected image
 * as either their profile photo or college ID.
 */
export async function promptAndUploadIdentity(
  type: 'photo' | 'collegeId',
  onLoadingChange?: (loading: boolean) => void
): Promise<UserProfile | null> {
  const title = type === 'photo' ? 'Profile Photo' : 'College ID Card';
  const description =
    type === 'photo'
      ? 'Upload a clear front-facing photo for festival security & pass accreditation.'
      : 'Upload a clear photo of your official college student ID card.';

  return new Promise((resolve) => {
    showAlert(
      title,
      description,
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                showAlert('Permission Required', 'Camera permission is required to capture your photo.');
                resolve(null);
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: type === 'photo' ? [1, 1] : [4, 3],
                quality: 0.8,
              });

              if (result.canceled || !result.assets?.[0]?.uri) {
                resolve(null);
                return;
              }

              onLoadingChange?.(true);
              const fileUri = result.assets[0].uri;
              const updated =
                type === 'photo'
                  ? await uploadProfilePhoto(fileUri)
                  : await uploadCollegeId(fileUri);

              useUserStore.getState().setUserData(updated);
              await useUserStore.getState().refreshUserProfile().catch(() => {});

              showAlert(
                'Success',
                type === 'photo'
                  ? 'Profile photo updated successfully!'
                  : 'College ID card uploaded successfully!'
              );
              resolve(updated);
            } catch (err: any) {
              showAlert('Upload Failed', err?.message || 'Failed to upload image. Please try again.');
              resolve(null);
            } finally {
              onLoadingChange?.(false);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            try {
              const result = await ImagePicker.launchImageLibraryAsync({
                allowsEditing: true,
                aspect: type === 'photo' ? [1, 1] : [4, 3],
                quality: 0.8,
              });

              if (result.canceled || !result.assets?.[0]?.uri) {
                resolve(null);
                return;
              }

              onLoadingChange?.(true);
              const fileUri = result.assets[0].uri;
              const updated =
                type === 'photo'
                  ? await uploadProfilePhoto(fileUri)
                  : await uploadCollegeId(fileUri);

              useUserStore.getState().setUserData(updated);
              await useUserStore.getState().refreshUserProfile().catch(() => {});

              showAlert(
                'Success',
                type === 'photo'
                  ? 'Profile photo updated successfully!'
                  : 'College ID card uploaded successfully!'
              );
              resolve(updated);
            } catch (err: any) {
              showAlert('Upload Failed', err?.message || 'Failed to upload image. Please try again.');
              resolve(null);
            } finally {
              onLoadingChange?.(false);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(null),
        },
      ]
    );
  });
}
