import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProfileService, UserProfile } from '../profile.service';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ImageSelectorModalComponent } from './image-selector-modal/image-selector-modal.component';
import { DeleteAccountModalComponent } from './delete-account-modal/delete-account-modal.component';
import { FtAuthService, FtUser } from '../ft-auth.service';
import { ActivatedRoute } from '@angular/router';
interface ImageSelection {
  type: 'preset' | 'upload';
  data: File | string; // File object for uploads, string identifier/path for presets
}@Component({
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

  ftAuthenticated: boolean = false;
  ftUserData: FtUser | null = null;
  ftLoading: boolean = false;
  ftError: string | null = null;

  selectedImages: {
    avatar?: ImageSelection;
    paddleskin?: ImageSelection;
    ballskin?: ImageSelection;
    gamebackground?: ImageSelection;
  } = {};

  constructor(
    private profileService: ProfileService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private http: HttpClient,
    private ftAuthService: FtAuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {

    this.route.queryParams.subscribe(params => {
      if (params['ftAuthError'] === 'true') {
        this.ftAuthenticated = false;
        this.ftError = 'Failed to authenticate with 42. Please try again.';
      }
    });

    this.initializeForm();
    this.loadProfile();
    this.checkFtAuthentication();
  }

  initializeForm() {
    this.profileForm = this.fb.group({
      display_name: ['', [Validators.maxLength(255)]],
      avatar: [null],
      avatar_to_delete: [false], // New flag for deletion
      
      paddleskin_color: ['#FFFFFF', [Validators.pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/)]],
      paddleskin_image: [null],
      paddleskin_image_to_delete: [false], // New flag for deletion
      
      ballskin_color: ['#FFFFFF', [Validators.pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/)]],
      ballskin_image: [null],
      ballskin_image_to_delete: [false], // New flag for deletion
      
      gamebackground_color: ['#000000', [Validators.pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/)]],
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
          paddleskin_color: data.paddleskin_color || '#FFFFFF',
          ballskin_color: data.ballskin_color || '#FFFFFF',
          gamebackground_color: data.gamebackground_color || '#000000',
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
    if (this.profileForm.get('display_name')!.value) {
      console.log('display_name', this.profileForm.get('display_name')!.value);
      formData.append('display_name', this.profileForm.get('display_name')!.value);
    } else {
      formData.delete('display_name');
    }
    

    // Avatar
    if (this.selectedImages.avatar) {
      if (this.selectedImages.avatar.type === 'upload') {
        formData.append('avatar', this.selectedImages.avatar.data as File);
      } else if (this.selectedImages.avatar.type === 'preset') {
        formData.append('avatar_preset', this.selectedImages.avatar.data as string);
      }
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
      if (this.selectedImages.paddleskin) {
        if (this.selectedImages.paddleskin.type === 'upload') {
          formData.append('paddleskin_image', this.selectedImages.paddleskin.data as File);
        } else if (this.selectedImages.paddleskin.type === 'preset') {
          formData.append('paddleskin_preset', this.selectedImages.paddleskin.data as string);
        }
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
      if (this.selectedImages.ballskin) {
        if (this.selectedImages.ballskin.type === 'upload') {
          formData.append('ballskin_image', this.selectedImages.ballskin.data as File);
        } else if (this.selectedImages.ballskin.type === 'preset') {
          formData.append('ballskin_preset', this.selectedImages.ballskin.data as string);
        }
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
      if (this.selectedImages.gamebackground) {
        if (this.selectedImages.gamebackground.type === 'upload') {
          formData.append('gamebackground_wallpaper', this.selectedImages.gamebackground.data as File);
        } else if (this.selectedImages.gamebackground.type === 'preset') {
          formData.append('gamebackground_preset', this.selectedImages.gamebackground.data as string);
        }
      }
      if (this.profileForm.get('gamebackground_wallpaper_to_delete')?.value) {
        formData.append('gamebackground_wallpaper_to_delete', 'true');
      }
    }
  
    // Append username if required
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
  
        // Clear selectedImages
        this.selectedImages = {};
  
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
  openImageSelector(field: keyof typeof this.selectedImages) {
    const modalRef = this.modalService.open(ImageSelectorModalComponent, { size: 'lg' });
    
    // Assuming presets are stored in assets/presets/
    const presets = this.getPresetsForField(field);
    
    modalRef.componentInstance.presetImages = presets;
    
    modalRef.result.then((selection: ImageSelection) => {
      if (selection) {
        this.setImage(field, selection);
      }
    }, (reason) => {
      // Handle dismissals if needed
    });
  }

  getPresetsForField(field: keyof typeof this.selectedImages): string[] {
    switch(field) {
      case 'avatar':
        return [
          'assets/presets/a1.jpg',
          'assets/presets/a2.png',
          'assets/presets/a3.jpg',
          'assets/presets/a4.jpg',
          'assets/presets/a5.jpg'
        ];
      case 'paddleskin':
        return [
          'assets/presets/p1.jpg',
          'assets/presets/p2.jpg',
          'assets/presets/p3.png'
          // Add more paddle skin presets as needed
        ];
      case 'ballskin':
        return [
          'assets/presets/b1.png',
          'assets/presets/b2.jpg',
          // Add more ball skin presets as needed
        ];
      case 'gamebackground':
        return [
          'assets/presets/g1.jpg',
          'assets/presets/g2.jpg',
          'assets/presets/g3.png'
          // Add more background presets as needed
        ];
      default:
        return [];
    }
  }

  // Method to set the selected image
  setImage(field: keyof typeof this.selectedImages, selection: ImageSelection) {
    if (selection.type === 'upload') {
      // Directly set the image as File
      this.selectedImages[field] = selection;
      // Update preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        switch(field) {
          case 'avatar':
            this.avatarPreview = e.target.result;
            break;
          case 'paddleskin':
            this.paddleskinImagePreview = e.target.result;
            break;
          case 'ballskin':
            this.ballskinImagePreview = e.target.result;
            break;
          case 'gamebackground':
            this.gamebackgroundImagePreview = e.target.result;
            break;
        }
      };
      reader.readAsDataURL(selection.data as File);
    } else if (selection.type === 'preset') {
      // Fetch the image as Blob
      this.http.get(selection.data as string, { responseType: 'blob' }).subscribe(
        (blob) => {
          // Convert Blob to File
          const file = new File([blob], this.getFileNameFromPath(selection.data as string), { type: blob.type });
          // Set the image as 'upload' with File data
          this.selectedImages[field] = {
            type: 'upload',
            data: file
          };
          // Update preview
          const reader = new FileReader();
          reader.onload = (e: any) => {
            switch(field) {
              case 'avatar':
                this.avatarPreview = e.target.result;
                break;
              case 'paddleskin':
                this.paddleskinImagePreview = e.target.result;
                break;
              case 'ballskin':
                this.ballskinImagePreview = e.target.result;
                break;
              case 'gamebackground':
                this.gamebackgroundImagePreview = e.target.result;
                break;
            }
          };
          reader.readAsDataURL(file);
        },
        (error) => {
          console.error('Error fetching preset image:', error);
          // Optionally, notify the user about the error
          alert('Failed to load the selected preset image. Please try another one.');
        }
      );
    }
  }
  
  // Helper method to extract file name from path
  getFileNameFromPath(path: string): string {
    return path.substring(path.lastIndexOf('/') + 1);
  }

  openDeleteAccountModal() {
    const modalRef = this.modalService.open(DeleteAccountModalComponent, { centered: true });
    modalRef.result.then((password: string) => {
      if (password) {
        this.deleteAccount(password);
      }
    }, (reason) => {
      // Handle dismissal if needed
    });
  }

  // Method to send delete account request
  deleteAccount(password: string) {
    if (confirm('Are you sure you want to delete your account? This action is irreversible.')) {
      this.profileService.deleteAccount(password).subscribe(
        (response) => {
          alert('Your account has been deleted successfully.');
          // Optionally, redirect to the homepage or login page
          window.location.href = '/';
        },
        (error: HttpErrorResponse) => {
          console.error('Error deleting account:', error);
          alert(error.error.message || 'An error occurred while deleting your account. Please try again.');
        }
      );
    }
  }
  checkFtAuthentication() {
    if (this.ftAuthService.isAuthenticated()) {
      this.ftLoading = true;
      this.ftAuthService.get42UserProfile().subscribe(
        (data) => {
          this.ftAuthenticated = true;
          this.ftUserData = data;
          this.ftLoading = false;
          // Optionally, update your userProfile with 42 data
          // this.userProfile.ftData = data;
          if (this.userProfile.is_ft_authenticated === false) {
            this.update42ValidationOnProfile();
          }

        },
        (error) => {
          console.error('Failed to fetch 42 user data:', error);
          this.ftAuthenticated = false;
          this.ftError = 'Failed to fetch 42 user data. Please log in again.';
          this.ftLoading = false;
          // Optionally, you can logout or prompt re-authentication
          // this.ftAuthService.logout();
        }
      );
    } else {
      this.ftAuthenticated = false;
    }
  }

  update42ValidationOnProfile() {
    this.userProfile.is_ft_authenticated = true;
    const formData = new FormData();
    formData.append('is_ft_authenticated', 'true');
    this.profileService.updateProfile(formData, this.userProfile.id).subscribe(
      (response) => {
        alert('Profile synced with 42 account successfully');
        // Reload the profile to reflect changes
        this.loadProfile();
  
        // Reset deletion flags
        this.profileForm.patchValue({
          avatar_to_delete: false,
          paddleskin_image_to_delete: false,
          ballskin_image_to_delete: false,
          gamebackground_wallpaper_to_delete: false,
        });
  
        // Clear selectedImages
        this.selectedImages = {};
        this.isUpdating = false;
      },
      (error: HttpErrorResponse) => {
        this.isUpdating = false;
        console.error('Error updating profile:', error);
        alert('An error occurred while updating your profile. Please try again.');
      }
    );
  }

  remove42ValidationOnProfile() {
    this.userProfile.is_ft_authenticated = false;
    const formData = new FormData();
    formData.append('is_ft_authenticated', 'false');
    this.profileService.updateProfile(formData, this.userProfile.id).subscribe(
      (response) => {
        alert('Removed 42 account from profile successfully');
        // Reload the profile to reflect changes
        this.loadProfile();
  
        // Reset deletion flags
        this.profileForm.patchValue({
          avatar_to_delete: false,
          paddleskin_image_to_delete: false,
          ballskin_image_to_delete: false,
          gamebackground_wallpaper_to_delete: false,
        });
  
        // Clear selectedImages
        this.selectedImages = {};
        this.isUpdating = false;
      },
      (error: HttpErrorResponse) => {
        this.isUpdating = false;
        console.error('Error updating profile:', error);
        alert('An error occurred while updating your profile. Please try again.');
      }
    );
  }


  loginViaFt() {
    this.ftAuthService.login();
  }

  // Optionally, you can provide a method to refresh or logout from 42
  logoutFromFt() {
    this.ftAuthService.logout();
    this.ftAuthenticated = false;
    this.ftUserData = null;
    this.remove42ValidationOnProfile();
  }
  
}
