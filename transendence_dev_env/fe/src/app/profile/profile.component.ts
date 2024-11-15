// src/app/profile/profile.component.ts

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
      
      paddleskin_color: ['#FF0000', [Validators.pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/)]],
      paddleskin_image: [null],
      
      ballskin_color: ['#0000FF', [Validators.pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/)]],
      ballskin_image: [null],
      
      gamebackground_color: ['#FFFFFF', [Validators.pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/)]],
      gamebackground_wallpaper: [null],
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
        this.avatarPreview = data.avatar || 'assets/default_avatar.png';
        this.paddleskinImagePreview = data.paddleskin_image || null;
        this.ballskinImagePreview = data.ballskin_image || null;
        this.gamebackgroundImagePreview = data.gamebackground_wallpaper || null;

        // Set customization options based on existing data
        this.paddleskinOption = data.paddleskin_image ? 'image' : 'color';
        this.ballskinOption = data.ballskin_image ? 'image' : 'color';
        this.gamebackgroundOption = data.gamebackground_wallpaper ? 'image' : 'color';

        // Disable color inputs if image is selected
        this.togglePaddleskinOption(this.paddleskinOption);
        this.toggleBallskinOption(this.ballskinOption);
        this.toggleGamebackgroundOption(this.gamebackgroundOption);

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

  // Handle Paddle Skin Option Change
  onPaddleskinOptionChange(option: 'color' | 'image') {
    this.paddleskinOption = option;
    if (option === 'image') {
      this.profileForm.get('paddleskin_color')?.disable();
    } else {
      this.profileForm.get('paddleskin_image')?.reset();
      this.profileForm.get('paddleskin_color')?.enable();
      this.paddleskinImagePreview = null;
    }
  }

  // Handle Ball Skin Option Change
  onBallskinOptionChange(option: 'color' | 'image') {
    this.ballskinOption = option;
    if (option === 'image') {
      this.profileForm.get('ballskin_color')?.disable();
    } else {
      this.profileForm.get('ballskin_image')?.reset();
      this.profileForm.get('ballskin_color')?.enable();
      this.ballskinImagePreview = null;
    }
  }

  // Handle Game Background Option Change
  onGamebackgroundOptionChange(option: 'color' | 'image') {
    this.gamebackgroundOption = option;
    if (option === 'image') {
      this.profileForm.get('gamebackground_color')?.disable();
    } else {
      this.profileForm.get('gamebackground_wallpaper')?.reset();
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

  // Handle Ball Skin Image Change
  onBallskinImageChange(event: { target: any }) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      const file = input.files[0];
      this.profileForm.patchValue({
        ballskin_image: file,
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

  // Handle Game Background Image Change
  onGamebackgroundImageChange(event: { target: any }) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      const file = input.files[0];
      this.profileForm.patchValue({
        gamebackground_wallpaper: file,
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

    // Paddle Skin
    if (this.paddleskinOption === 'color') {
      formData.append('paddleskin_color', this.profileForm.get('paddleskin_color')!.value);
    } else if (this.paddleskinOption === 'image' && this.profileForm.get('paddleskin_image')?.value) {
      formData.append('paddleskin_image', this.profileForm.get('paddleskin_image')!.value);
    }

    // Ball Skin
    if (this.ballskinOption === 'color') {
      formData.append('ballskin_color', this.profileForm.get('ballskin_color')!.value);
    } else if (this.ballskinOption === 'image' && this.profileForm.get('ballskin_image')?.value) {
      formData.append('ballskin_image', this.profileForm.get('ballskin_image')!.value);
    }

    // Game Background
    if (this.gamebackgroundOption === 'color') {
      formData.append('gamebackground_color', this.profileForm.get('gamebackground_color')!.value);
    } else if (this.gamebackgroundOption === 'image' && this.profileForm.get('gamebackground_wallpaper')?.value) {
      formData.append('gamebackground_wallpaper', this.profileForm.get('gamebackground_wallpaper')!.value);
    }

    this.profileService.updateProfile(formData).subscribe(
      (response) => {
        alert('Profile updated successfully');
        // Reload the profile to reflect changes
        this.loadProfile();
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

  togglePaddleskinOption(option: 'color' | 'image') {
    this.paddleskinOption = option;
    if (option === 'image') {
      this.profileForm.get('paddleskin_color')?.disable();
    } else {
      this.profileForm.get('paddleskin_image')?.reset();
      this.profileForm.get('paddleskin_color')?.enable();
      this.paddleskinImagePreview = null;
    }
  }

  toggleBallskinOption(option: 'color' | 'image') {
    this.ballskinOption = option;
    if (option === 'image') {
      this.profileForm.get('ballskin_color')?.disable();
    } else {
      this.profileForm.get('ballskin_image')?.reset();
      this.profileForm.get('ballskin_color')?.enable();
      this.ballskinImagePreview = null;
    }
  }

  toggleGamebackgroundOption(option: 'color' | 'image') {
    this.gamebackgroundOption = option;
    if (option === 'image') {
      this.profileForm.get('gamebackground_color')?.disable();
    } else {
      this.profileForm.get('gamebackground_wallpaper')?.reset();
      this.profileForm.get('gamebackground_color')?.enable();
      this.gamebackgroundImagePreview = null;
    }
  }
}
