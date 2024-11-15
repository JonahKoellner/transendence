import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProfileService, UserProfile } from '../profile.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  profileForm!: FormGroup;
  avatarPreview!: string | ArrayBuffer | null;
  paddleskinImagePreview!: string | ArrayBuffer | null;
  ballskinImagePreview!: string | ArrayBuffer | null;
  gamebackgroundImagePreview!: string | ArrayBuffer | null;
  isLoading = true;
  isUpdating = false;
  userProfile!: UserProfile;
  
  // Options for customization
  paddleskinOption: 'color' | 'image' = 'color';
  ballskinOption: 'color' | 'image' = 'color';
  gamebackgroundOption: 'color' | 'image' = 'color';

  constructor(
    private profileService: ProfileService,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.initializeForm();
    this.loadProfile();
  }

  initializeForm() {
    this.profileForm = this.fb.group({
      display_name: ['', [Validators.maxLength(255)]],
      avatar: [null],
      avatar_to_delete: [false], // New flag for deletion
      
      paddleskin_color: ['#FF0000', [Validators.pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/)]],
      paddleskin_image: [null],
      paddleskin_image_to_delete: [false], // New flag for deletion
      
      ballskin_color: ['#0000FF', [Validators.pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/)]],
      ballskin_image: [null],
      ballskin_image_to_delete: [false], // New flag for deletion
      
      gamebackground_color: ['#FFFFFF', [Validators.pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/)]],
      gamebackground_wallpaper: [null],
      gamebackground_wallpaper_to_delete: [false], // New flag for deletion
    });
  }

  loadProfile() {
    this.isLoading = true;

    this.profileService.getProfile().subscribe(
      (data) => {
        this.userProfile = data;

        // Set form values
        this.profileForm.patchValue({
          display_name: data.display_name,
          paddleskin_color: data.paddleskin_color || '#FF0000',
          ballskin_color: data.ballskin_color || '#0000FF',
          gamebackground_color: data.gamebackground_color || '#FFFFFF',
        });

        // Set image previews
        this.avatarPreview = data.avatar || null;
        this.paddleskinImagePreview = data.paddleskin_image || null;
        this.ballskinImagePreview = data.ballskin_image || null;
        this.gamebackgroundImagePreview = data.gamebackground_wallpaper || null;

        // Set customization options based on existing data
        this.paddleskinOption = data.paddleskin_image ? 'image' : 'color';
        this.ballskinOption = data.ballskin_image ? 'image' : 'color';
        this.gamebackgroundOption = data.gamebackground_wallpaper ? 'image' : 'color';

        // Disable color inputs if image is selected
        this.togglePaddleskinOption(this.paddleskinOption, false);
        this.toggleBallskinOption(this.ballskinOption, false);
        this.toggleGamebackgroundOption(this.gamebackgroundOption, false);

        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading profile:', error);
        this.isLoading = false;
      }
    );
  }

  // Handle display name and avatar
  onFileChange(event: { target: any }) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      const file = input.files[0];
      this.profileForm.patchValue({
        avatar: file,
        avatar_to_delete: false, // Reset deletion flag if uploading new image
      });
      this.profileForm.get('avatar')?.updateValueAndValidity();

      // File Preview
      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // Delete Avatar
  deleteAvatar() {
    this.profileForm.patchValue({
      avatar: null,
      avatar_to_delete: true, // Flag for deletion
    });
    this.avatarPreview = null;
    this.userProfile.avatar = ""; // Update UI immediately
  }

  // Handle Paddle Skin Option Change
  togglePaddleskinOption(option: 'color' | 'image', emitEvent: boolean = true) {
    this.paddleskinOption = option;
    if (option === 'image') {
      this.profileForm.get('paddleskin_color')?.disable();
      this.profileForm.get('paddleskin_color')?.setValue('#FF0000'); // Reset to default or keep existing
    } else {
      this.profileForm.get('paddleskin_image')?.reset();
      this.profileForm.get('paddleskin_image_to_delete')?.setValue(false); // Reset deletion flag
      this.profileForm.get('paddleskin_color')?.enable();
      this.paddleskinImagePreview = null;
    }
  }

  // Handle Ball Skin Option Change
  toggleBallskinOption(option: 'color' | 'image', emitEvent: boolean = true) {
    this.ballskinOption = option;
    if (option === 'image') {
      this.profileForm.get('ballskin_color')?.disable();
      this.profileForm.get('ballskin_color')?.setValue('#0000FF'); // Reset to default or keep existing
    } else {
      this.profileForm.get('ballskin_image')?.reset();
      this.profileForm.get('ballskin_image_to_delete')?.setValue(false); // Reset deletion flag
      this.profileForm.get('ballskin_color')?.enable();
      this.ballskinImagePreview = null;
    }
  }

  // Handle Game Background Option Change
  toggleGamebackgroundOption(option: 'color' | 'image', emitEvent: boolean = true) {
    this.gamebackgroundOption = option;
    if (option === 'image') {
      this.profileForm.get('gamebackground_color')?.disable();
      this.profileForm.get('gamebackground_color')?.setValue('#FFFFFF'); // Reset to default or keep existing
    } else {
      this.profileForm.get('gamebackground_wallpaper')?.reset();
      this.profileForm.get('gamebackground_wallpaper_to_delete')?.setValue(false); // Reset deletion flag
      this.profileForm.get('gamebackground_color')?.enable();
      this.gamebackgroundImagePreview = null;
    }
  }

  // Handle Paddle Skin Image Change
  onPaddleskinImageChange(event: { target: any }) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      const file = input.files[0];
      this.profileForm.patchValue({
        paddleskin_image: file,
        paddleskin_image_to_delete: false, // Reset deletion flag if uploading new image
      });
      this.profileForm.get('paddleskin_image')?.updateValueAndValidity();

      // Image Preview
      const reader = new FileReader();
      reader.onload = () => {
        this.paddleskinImagePreview = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // Delete Paddle Skin Image
  deletePaddleskinImage() {
    this.profileForm.patchValue({
      paddleskin_image: null,
      paddleskin_image_to_delete: true, // Flag for deletion
    });
    this.paddleskinImagePreview = null;
    this.userProfile.paddleskin_image = ""; // Update UI immediately
  }

  // Handle Ball Skin Image Change
  onBallskinImageChange(event: { target: any }) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      const file = input.files[0];
      this.profileForm.patchValue({
        ballskin_image: file,
        ballskin_image_to_delete: false, // Reset deletion flag if uploading new image
      });
      this.profileForm.get('ballskin_image')?.updateValueAndValidity();

      // Image Preview
      const reader = new FileReader();
      reader.onload = () => {
        this.ballskinImagePreview = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // Delete Ball Skin Image
  deleteBallskinImage() {
    this.profileForm.patchValue({
      ballskin_image: null,
      ballskin_image_to_delete: true, // Flag for deletion
    });
    this.ballskinImagePreview = null;
    this.userProfile.ballskin_image = ""; // Update UI immediately
  }

  // Handle Game Background Image Change
  onGamebackgroundImageChange(event: { target: any }) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      const file = input.files[0];
      this.profileForm.patchValue({
        gamebackground_wallpaper: file,
        gamebackground_wallpaper_to_delete: false, // Reset deletion flag if uploading new image
      });
      this.profileForm.get('gamebackground_wallpaper')?.updateValueAndValidity();

      // Image Preview
      const reader = new FileReader();
      reader.onload = () => {
        this.gamebackgroundImagePreview = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // Delete Game Background Image
  deleteGamebackgroundImage() {
    this.profileForm.patchValue({
      gamebackground_wallpaper: null,
      gamebackground_wallpaper_to_delete: true, // Flag for deletion
    });
    this.gamebackgroundImagePreview = null;
    this.userProfile.gamebackground_wallpaper = ""; // Update UI immediately
  }

  onSubmit() {
    if (this.profileForm.invalid) {
      return;
    }

    this.isUpdating = true;

    const formData = new FormData();
    formData.append('display_name', this.profileForm.get('display_name')!.value);

    // Avatar
    if (this.profileForm.get('avatar')?.value) {
      formData.append('avatar', this.profileForm.get('avatar')!.value);
    }
    if (this.profileForm.get('avatar_to_delete')?.value) {
      formData.append('avatar_to_delete', 'true');
    }

    // Paddle Skin
    if (this.paddleskinOption === 'color') {
      formData.append('paddleskin_color', this.profileForm.get('paddleskin_color')!.value);
      if (this.profileForm.get('paddleskin_image_to_delete')?.value) {
        formData.append('paddleskin_image_to_delete', 'true');
      }
    } else if (this.paddleskinOption === 'image') {
      if (this.profileForm.get('paddleskin_image')?.value) {
        formData.append('paddleskin_image', this.profileForm.get('paddleskin_image')!.value);
      }
      if (this.profileForm.get('paddleskin_image_to_delete')?.value) {
        formData.append('paddleskin_image_to_delete', 'true');
      }
    }

    // Ball Skin
    if (this.ballskinOption === 'color') {
      formData.append('ballskin_color', this.profileForm.get('ballskin_color')!.value);
      if (this.profileForm.get('ballskin_image_to_delete')?.value) {
        formData.append('ballskin_image_to_delete', 'true');
      }
    } else if (this.ballskinOption === 'image') {
      if (this.profileForm.get('ballskin_image')?.value) {
        formData.append('ballskin_image', this.profileForm.get('ballskin_image')!.value);
      }
      if (this.profileForm.get('ballskin_image_to_delete')?.value) {
        formData.append('ballskin_image_to_delete', 'true');
      }
    }

    // Game Background
    if (this.gamebackgroundOption === 'color') {
      formData.append('gamebackground_color', this.profileForm.get('gamebackground_color')!.value);
      if (this.profileForm.get('gamebackground_wallpaper_to_delete')?.value) {
        formData.append('gamebackground_wallpaper_to_delete', 'true');
      }
    } else if (this.gamebackgroundOption === 'image') {
      if (this.profileForm.get('gamebackground_wallpaper')?.value) {
        formData.append('gamebackground_wallpaper', this.profileForm.get('gamebackground_wallpaper')!.value);
      }
      if (this.profileForm.get('gamebackground_wallpaper_to_delete')?.value) {
        formData.append('gamebackground_wallpaper_to_delete', 'true');
      }
    }
    formData.append("username", this.userProfile.username);
    this.profileService.updateProfile(formData, this.userProfile.id).subscribe(
      (response) => {
        alert('Profile updated successfully');
        // Reload the profile to reflect changes
        this.loadProfile();

        // Reset deletion flags
        this.profileForm.patchValue({
          avatar_to_delete: false,
          paddleskin_image_to_delete: false,
          ballskin_image_to_delete: false,
          gamebackground_wallpaper_to_delete: false,
        });

        this.isUpdating = false;
      },
      (error: HttpErrorResponse) => {
        this.isUpdating = false;
        console.error('Error updating profile:', error);
        alert('An error occurred while updating your profile. Please try again.');
      }
    );
  }

  getXpProgress(): number {
    if (!this.userProfile) return 0;
    return Math.min((this.userProfile.xp / this.userProfile.xp_for_next_level) * 100, 100);
  }

}
