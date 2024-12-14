import { Component, OnInit, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface SubModule {
  description: string;
  status: 'completed' | 'incomplete' | 'in_progress';
}

interface Module {
  totalPoints: number;
  name: string;
  status: 'completed' | 'incomplete' | 'in_progress';
  description: string;
  details: string;
  implementationDetails: string[];
  subModules: SubModule[];
  completedSubModules?: number; // Computed property
  totalSubModules?: number;     // Computed property
}

interface Contributor {
  name: string;
  avatar: string;
  role: string;
}

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit, OnDestroy {
  pdfSrc: string = 'assets/subject.pdf';
  konamiCode: string[] = [
    'ArrowUp', 'ArrowUp',
    'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight',
    'ArrowLeft', 'ArrowRight',
    'b', 'a'
  ];
  konamiIndex: number = 0;

  // Reference to the event handler for removal
  private keyDownHandler!: (e: KeyboardEvent) => void;

  // Controls the visibility of the retro game modal
  showRetroGameModal: boolean = false;

  // Safe URL for the retro game iframe
  retroGameUrl!: SafeResourceUrl;

  // Selected module for the details dialog
  selectedModule: Module | null = null;

  // Contributors data
  contributors: Contributor[] = [
    {
      name: 'Lukas Kreuzer',
      avatar: 'https://cdn.intra.42.fr/users/384cad88316a2ad0b74b16caa26fff48/lkreuzer.png',
      role: 'Focused on backend development and server-side logic.'
    },
    {
      name: 'Jonah Köllner',
      avatar: 'https://cdn.intra.42.fr/users/33446a7c706db8e85a8a1f272e42b014/jkollner.jpg',
      role: 'Focused on front-end design and user experience.'
    },
    {
      name: 'Gergely Pásztor',
      avatar: 'https://cdn.intra.42.fr/users/3c1f08193b22c4acd4b8abd1f431a693/gpasztor.jpg',
      role: 'Focused on database integration and API development.'
    },
    {
      name: 'Niklas Burchhardt',
      avatar: 'https://cdn.intra.42.fr/users/8c087da4532c6d41740814505a57a870/nburchha.jpg',
      role: 'Coordinated the project and ensured timely delivery.'
    },
    {
      name: 'Felix Böck',
      avatar: 'https://cdn.intra.42.fr/users/896c969a835505db23a2c1cb9cd5527c/fbock.jpg',
      role: 'Focused on testing and maintaining code quality.'
    }
  ];

  // Modules data
  modules: Module[] = [
    {
      name: 'Web',
      status: 'completed',
      description: 'Web Development Module',
      details: 'This module covers the implementation of the web framework, front-end integration, and database management.',
      totalPoints: 2,
      implementationDetails: [
        'Used Django as the backend framework for robust server-side operations.',
        'Leveraged Angular and Bootstrap for dynamic and responsive UI development.',
        'Integrated PostgreSQL for efficient relational data management.',
        'Decided not to implement due to unclear requirements and limited practical benefits.'
      ],
      subModules: [
        { description: 'Use a Framework as backend (1 point) - Integrated using Django.', status: 'completed' },
        { description: 'Use a front-end framework (0.5 points) - Leveraged Angular and Bootstrap for UI development.', status: 'completed' },
        { description: 'Database Integration (0.5 points) - Implemented with PostgreSQL for relational data management.', status: 'completed' },
        { description: 'Blockchain Score Storage (1 point)', status: 'incomplete' }
      ]
    },
    {
      name: 'User Management',
      status: 'completed',
      description: 'User Management Module',
      details: 'Focused on implementing secure user authentication and management features.',
      totalPoints: 2,
      implementationDetails: [
        'Implemented standard user management and authentication using JWT with Django and Angular tools.',
        'Enabled remote authentication to allow users to log in from various devices securely.'
      ],
      subModules: [
        { description: 'Standard user management and authentication (1 point) - Implemented with JWT Django and Angular tools.', status: 'completed' },
        { description: 'Remote authentication (1 point)', status: 'completed' }
      ]
    },
    {
      name: 'Gameplay and User Experience',
      status: 'in_progress',
      description: 'Gameplay and User Experience Module',
      details: 'Enhancing gameplay features and overall user experience through real-time interactions and customization.',
      totalPoints: 3.5,
      implementationDetails: [
        'Enabled remote players through WebSockets for real-time multiplayer interactions.',
        'Added an Arena Mode to support multiple players in competitive gameplay.',
        'We didnt want to add another game with user history and matchmaking due to time constraints and limited resources.',
        'Implemented game customization options allowing players to set custom colors, skins, and round settings.',
        'Integrated live chat using WebSockets for seamless in-game communication.'
      ],
      subModules: [
        { description: 'Remote players (1 point) - Enabled through WebSockets.', status: 'completed' },
        { description: 'Multiple players (1 point) - Added an Arena Mode.', status: 'completed' },
        { description: 'Add Another Game with User History and Matchmaking (1 point)', status: 'incomplete' },
        { description: 'Game Customization Options (0.5 points) - Players can set custom colors, skins and round settings.', status: 'completed' },
        { description: 'Live Chat (1 point) - Implemented with WebSockets for real-time messaging.', status: 'completed' }
      ]
    },
    {
      name: 'AI-Algo',
      status: 'in_progress',
      description: 'AI Algorithms Module',
      details: 'Developing AI components to enhance gameplay through intelligent opponents and dynamic statistics tracking.',
      totalPoints: 1.5,
      implementationDetails: [
        'Introduced an AI opponent with a predictive algorithm to calculate ball trajectory and simulate human-like reactions.',
        'Designed user and game stats dashboards using Chart.js for dynamic and interactive data visualization.'
      ],
      subModules: [
        { description: 'Introduce an AI Opponent (1 point) - Implemented a predictive algorithm to calculate ball trajectory and simulate human-like reactions with difficulty-based randomness and speed adjustments.', status: 'completed' },
        { description: 'User and Game Stats Dashboards (0.5 points) - Designed with Chart.js for dynamic visuals.', status: 'completed' }
      ]
    },
    {
      name: 'Cybersecurity',
      status: 'completed',
      description: 'Cybersecurity Module',
      details: 'Ensuring the security of the application through various measures and compliance standards.',
      totalPoints: 2.5,
      implementationDetails: [
        'Implemented WAF/ModSecurity with hardened configuration and HashiCorp Vault for secrets management.',
        'Implemented GDPR compliance options with user anonymization, local data management, and account deletion capabilities.',
        'Enhanced security with Two-Factor Authentication (2FA) with a OTP and JWT for robust authentication mechanisms.'
      ],
      subModules: [
        { description: 'Implement WAF/ModSecurity with Hardened Configuration and HashiCorp Vault for Secrets Management (1 point)', status: 'completed' },
        { description: 'GDPR Compliance Options with User Anonymization, Local Data Management, and Account Deletion (0.5 points)', status: 'completed' },
        { description: 'Implement Two-Factor Authentication (2FA) and JWT (1 point) - Enhanced security through OTP-based 2FA.', status: 'completed' }
      ]
    },
    {
      name: 'DevOps',
      status: 'in_progress',
      description: 'DevOps Module',
      details: 'Setting up and managing the infrastructure, monitoring systems, and ensuring smooth deployment processes.',
      totalPoints: 1,
      implementationDetails: [
        'Established infrastructure setup with ELK for comprehensive log management and analysis.',
        'Currently developing a monitoring system to track application performance and uptime.',
        'Designing the backend as microservice was not implemented due to existing monolithic architecture and time constraints.'
      ],
      subModules: [
        { description: 'Infrastructure Setup with ELK for Log Management (1 point)', status: 'completed' },
        { description: 'Monitoring system (0.5 points)', status: 'in_progress' },
        { description: 'Designing the Backend as Microservices (1 point)', status: 'incomplete' }
      ]
    },
    {
      name: 'Graphics',
      status: 'in_progress',
      description: 'Graphics Module',
      details: 'Developing advanced 3D graphics techniques to enhance visual appeal and user engagement.',
      totalPoints: 0,
      implementationDetails: [
        'Currently implementing advanced 3D techniques to improve game visuals and user experience.'
      ],
      subModules: [
        { description: 'Implementing Advanced 3D Techniques (1 point)', status: 'in_progress' }
      ]
    },
    {
      name: 'Accessibility',
      status: 'in_progress',
      description: 'Accessibility Module',
      details: 'Making the application accessible to all users by supporting multiple devices, languages, and accessibility features.',
      totalPoints: 0.5,
      implementationDetails: [
        'Creating pong on mobile was too tedious due to the complexity of the UI and game mechanics.',
        'Ensured expanding browser compatibility to support all major browsers.',
        'Decided to just use english as the main language due to time constraints and limited practical benefits.',
        'Adding accessibility features for visually impaired users to enhance inclusivity.',
        'We didnt want to add server-side rendering due to time constraints and limited practical benefits.'
      ],
      subModules: [
        { description: 'Support on all devices (0.5 points)', status: 'incomplete' },
        { description: 'Expanding Browser Compatibility (0.5 points) - Ensured functionality across all major browsers.', status: 'completed' },
        { description: 'Multiple language supports (0.5 points)', status: 'incomplete' },
        { description: 'Add accessibility for Visually Impaired Users (0.5 points)', status: 'in_progress' },
        { description: 'Server-Side Rendering (SSR) Integration (0.5 points)', status: 'incomplete' }
      ]
    },
    {
      name: 'Server-Side Pong',
      status: 'incomplete',
      description: 'Server-Side Pong Module',
      details: 'Enhancing the classic Pong game with server-side logic and API integration for extended functionalities.',
      totalPoints: 1,
      implementationDetails: [
        'Replaced basic Pong with Server-Side Pong and implemented a robust API to handle game logic for all online games.',
        'Pending enabling Pong gameplay via CLI against web users with full API integration.'
      ],
      subModules: [
        { description: 'Replacing Basic Pong with Server-Side Pong and Implementing an API (1 point) - Enhanced gameplay with server-side logic.', status: 'completed' },
        { description: 'Enabling Pong Gameplay via CLI against Web Users with API Integration (1 point)', status: 'incomplete' }
      ]
    }
  ];

  constructor(public sanitizer: DomSanitizer) { }

  ngOnInit() {
    this.loadKonamiCode();
    this.computeModuleProgress();
  }

  ngOnDestroy() {
    // Remove the event listener when the component is destroyed to prevent memory leaks
    document.removeEventListener('keydown', this.keyDownHandler);
  }

  loadKonamiCode() {
    this.keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === this.konamiCode[this.konamiIndex]) {
        this.konamiIndex++;
        if (this.konamiIndex === this.konamiCode.length) {
          this.activateEasterEgg();
          this.konamiIndex = 0;
        }
      } else {
        this.konamiIndex = 0;
      }
    };

    document.addEventListener('keydown', this.keyDownHandler);
  }

  activateEasterEgg() {
    // Display a playful alert
    alert("🎉 Konami Code Activated! Enjoy the retro game! 🎮");

    // Set the retro game URL (you can choose any embeddable retro game)
    // Example: Classic Snake game
    this.retroGameUrl = this.sanitizer.bypassSecurityTrustResourceUrl('https://codepen.io/GeekyAnts/embed/wvrMRo?default-tab=result');

    // Show the retro game modal
    this.showRetroGameModal = true;
  }

  closeRetroGameModal() {
    this.showRetroGameModal = false;
  }

  // Method to open module details dialog
  openModuleDialog(module: Module) {
    this.selectedModule = module;
  }

  // Method to close module details dialog
  closeModuleDialog(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.selectedModule = null;
  }

  // Compute the number of completed submodules and total submodules for each module
  computeModuleProgress() {
    this.modules.forEach(module => {
      module.totalSubModules = module.subModules.length;
      module.completedSubModules = module.subModules.filter(sub => sub.status === 'completed').length;
      
      // Update module.status based on progress
      if (module.completedSubModules === module.totalSubModules) {
        module.status = 'completed';
      } else if (module.completedSubModules > 0) {
        module.status = 'in_progress';
      } else {
        module.status = 'incomplete';
      }
    });
  }
}
