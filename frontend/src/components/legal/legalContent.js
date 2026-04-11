/**
 * Legal document content data.
 * Content is separated from presentation to allow easy updates
 * without modifying component logic.
 */

export const COMPANY_INFO = {
  name: 'Sadaora Inc.',
  brandName: 'Idii.',
  address: '5850 W. 3rd St Ste. E #1613',
  city: 'Los Angeles',
  state: 'CA',
  zip: '90036',
  email: 'Info@sadaora.com',
  supportEmail: 'support@sadaora.com',
  website: 'app.idii.co',
  logo: '/final_logo1-svg.png',
};

export const PRIVACY_POLICY = {
  title: 'Privacy Policy',
  effectiveDate: 'December 10, 2025',
  lastUpdated: '01/20/2026',
  intro: `This Privacy Policy explains how ${COMPANY_INFO.name} ("Sadaora," "${COMPANY_INFO.brandName}," "we," "us," or "our") collects, uses, shares, and protects personal information when you use our websites, mobile applications, platforms, and related services ("Services").`,
  consentNotice: 'By accessing or using our Services, you agree to this Privacy Policy.',
  sections: [
    {
      title: 'INFORMATION WE COLLECT',
      subsections: [
        {
          title: 'Personal Information You Provide',
          items: [
            'Name',
            'Email Address',
            'Account username and password',
            'Date of birth or age range',
            'Demographic information (such as gender, location, etc.) when you choose to provide it',
          ],
        },
        {
          title: 'Profile and Career Information',
          items: [
            'Professional background',
            'Educational qualifications and credentials',
            'Career goals and preferences',
            'Skills and competencies',
            'Professional certifications',
          ],
        },
        {
          title: 'Content You Upload',
          items: [
            'Resumes and curriculum vitae',
            'Communications with our support team',
            'Feedback, survey responses, and other correspondence',
            'User-generated content and posts',
          ],
        },
        {
          title: 'Payment Information',
          items: [
            'Billing Address',
            'Payment method details (processed securely through third-party payment processors)',
            'Transaction History',
          ],
        },
        {
          title: 'Information We Collect Automatically',
          description: 'When you access or use our Services, we automatically collect:',
          groups: [
            {
              title: 'Device and Usage Information',
              items: [
                'Device type, operating system, and browser type',
                'IP address and general location information',
                'Pages viewed and features accessed',
                'Time and date of visits',
                'Referring and exit pages',
                'Click-stream data',
              ],
            },
          ],
        },
        {
          title: 'Cookies and Technologies',
          items: [
            'We use cookies, web beacons, and similar tracking technologies to collect information about your browsing activities',
          ],
        },
        {
          title: 'Information from Other Sources',
          description: 'We may receive information about you from:',
          items: [
            'Third-party services you connect to your account (such as social media platforms)',
            'Publicly available sources',
            'Business partners and affiliates',
            'Other users who interact with you on our platform',
          ],
        },
      ],
    },
    {
      title: 'HOW WE USE YOUR INFORMATION',
      description: 'We use the information we collect for the following purposes:',
      subsections: [
        {
          title: 'To Provide and Maintain Our Services',
          items: [
            'Create and manage your account',
            'Process your transactions and fulfill your requests',
            'Provide customer support and respond to your inquiries',
            'Enable core platform functionality and features',
            'Authenticate users and maintain account security',
          ],
        },
        {
          title: 'To Personalize Your Experience',
          items: [
            'Deliver personalized content and recommendations using machine learning (ML) and artificial intelligence algorithms (AI)',
            'Customize your user interface and platform experience',
            'Tailor job opportunities and career suggestions based on your profile',
            'Suggest relevant connections and networking opportunities',
            'Analyze your skills and qualifications to improve matching accuracy',
          ],
        },
        {
          title: 'To Enable Communication Features',
          items: [
            'Send transactional emails (account confirmations, password resets, receipts)',
            'Deliver service-related announcements and updates',
            'Send marketing communications, newsletters, and promotional offers (with consent where required)',
            'Respond to your comments, questions, and requests',
          ],
          note: 'You may opt out of marketing communications at any time by following the unsubscribe instructions in those messages or by updating your profile preferences.',
        },
        {
          title: 'To Analyze and Improve Our Services',
          items: [
            'Monitor and analyze usage patterns, trends, and user behavior',
            'Conduct research and analytics to improve platform quality and performance',
            'Test new features and functionality',
            'Measure the effectiveness of our Services',
            'Develop new products and services',
          ],
        },
        {
          title: 'To Ensure Security and Prevent Fraud',
          items: [
            'Detect, prevent, and investigate fraudulent transactions and unauthorized access',
            'Monitor for security threats and suspicious activity',
            'Enforce our Terms of Service and other policies',
            'Protect the rights, property, and safety of our users and the public',
            'Verify user identity and authenticate accounts',
          ],
        },
        {
          title: 'To Comply With Legal Obligations',
          items: [
            'Respond to legal requests from law enforcement or regulatory authorities',
            'Comply with applicable laws, regulations, and legal processes',
            'Enforce our legal rights and defend against legal claims',
            'Fulfill tax, accounting, and reporting requirements',
            'Cooperate with government investigations when legally required',
          ],
        },
        {
          title: 'Aggregated and Anonymized Data',
          description: 'We may use your information in anonymized and aggregated form that does not identify you personally for:',
          items: [
            'Industry research and reporting',
            'Statistical analysis and benchmarking',
            'Market trends and insights',
            'Product development and innovation',
            'Public datasets and publications',
          ],
          note: 'This anonymized data cannot be used to identify you and is not considered personal information under applicable privacy laws.',
        },
        {
          title: 'With Your Consent',
          description: 'We may use your information for other purposes with your explicit consent, which you may withdraw at any time through your account settings or by contacting us.',
        },
      ],
    },
    {
      title: 'HOW WE SHARE YOUR INFORMATION',
      description: 'We do not sell your personal information to third parties. We may share your information in the following circumstances:',
      subsections: [
        {
          title: 'With Service Providers and Business Partners',
          description: 'We share information with third-party service providers who perform services on our behalf, including:',
          groups: [
            {
              title: 'Infrastructure and Hosting',
              items: [
                'Cloud storage and hosting providers',
                'Content delivery networks',
                'Database management services',
              ],
            },
            {
              title: 'Analytics and Performance',
              items: [
                'Analytics platforms to understand user behavior and improve our Services',
                'Performance monitoring and optimization tools',
                'A/B testing and user research platforms',
              ],
            },
            {
              title: 'Communication Services',
              items: [
                'Email service providers',
                'SMS and messaging platforms',
                'Customer support and helpdesk tools',
                'Push notification services',
              ],
            },
            {
              title: 'Payment Processing',
              items: [
                'Payment processors, including Stripe, to handle billing and transactions',
                'Fraud prevention and risk assessment services',
                'Payment gateway providers',
              ],
            },
            {
              title: 'Other Business Tools',
              items: [
                'Customer relationship management (CRM) systems',
                'Marketing automation platforms',
                'Scheduling and calendar tools',
              ],
            },
          ],
          note: 'These service providers are contractually obligated to protect your information, use it only for the purposes we specify, and maintain appropriate security measures.',
        },
        {
          title: 'With Other Users',
          description: 'Depending on your privacy settings and how you use our Services:',
          items: [
            'Your profile information may be visible to other users',
            'Content you post in public forums or communities is publicly accessible',
            'Messages you send to other users are shared with those recipients',
            'Your activity and interactions may be visible to connected users',
          ],
          note: 'You can control much of this sharing through your privacy settings.',
        },
        {
          title: 'For Legal Compliance and Protection',
          description: 'We may disclose your information when we believe it is necessary to:',
          groups: [
            {
              title: 'Comply with Legal Obligations',
              items: [
                'Respond to subpoenas, court orders, or other legal processes',
                'Comply with government or regulatory requests',
                'Meet national security or law enforcement requirements',
                'Fulfill tax, audit, or regulatory reporting obligations',
              ],
            },
            {
              title: 'Enforce Our Rights',
              items: [
                'Enforce our Terms of Service, policies, and user agreements',
                'Investigate and prevent violations of our terms',
                'Protect against fraud, abuse, or illegal activity',
                'Defend our legal rights in litigation or disputes',
              ],
            },
            {
              title: 'Protect Safety',
              items: [
                'Protect the safety, rights, and property of our users',
                'Prevent harm to individuals or the public',
                'Respond to emergencies involving danger of death or serious physical injury',
              ],
            },
          ],
        },
        {
          title: 'In Connection with Business Transfers',
          description: 'If we are involved in a merger, acquisition, financing, reorganization, bankruptcy, dissolution, or sale of company assets, your information may be transferred as part of that transaction. In such cases:',
          items: [
            'We will provide notice before your information is transferred',
            'The acquiring entity will be bound by the commitments made in this Privacy Policy',
            'You will be notified of any material changes to how your information is handled',
          ],
        },
        {
          title: 'With Your Consent',
          description: 'We may share your information with third parties when you explicitly consent to such sharing, such as:',
          items: [
            'When you authorize third-party integrations or applications',
            'When you choose to share content publicly or with specific individuals',
            'When you participate in co-branded offerings or partnerships',
            'For purposes you specifically approve at the time of sharing',
          ],
        },
        {
          title: 'Aggregated or Anonymized Information',
          description: 'We may share aggregated, anonymized, or de-identified information that cannot reasonably be used to identify you with:',
          items: [
            'Research institutions for academic studies',
            'Industry partners for benchmarking and analysis',
            'The public through reports, presentations, or product development',
          ],
          note: 'This information does not constitute personal information under applicable privacy laws.',
        },
      ],
    },
    {
      title: 'DATA RETENTION',
      description: 'We retain your personal information for as long as necessary to provide our Services and fulfill the purposes outlined in this Privacy Policy.',
      subsections: [
        {
          title: 'Retention Periods',
          groups: [
            {
              title: 'Active Accounts',
              description: 'Information is retained while your account is active to provide Services and maintain platform functionality.',
            },
            {
              title: 'After Account Termination',
              description: 'We may retain your personal data for three (3) years following account closure or termination.',
            },
            {
              title: 'Extended Retention',
              description: 'We may retain information beyond three (3) years when required by:',
              items: [
                'Legal, regulatory, tax, or accounting obligations (e.g., financial records retained for 7 years)',
                'Ongoing litigation, investigations, or legal holds',
                'Fraud prevention or security purposes',
                'Dispute resolution or contract enforcement',
              ],
            },
            {
              title: 'Earlier Deletion',
              description: 'You may request deletion of your information before the standard retention period where permitted under applicable U.S. law, subject to legal exceptions and legitimate business interests.',
            },
          ],
        },
        {
          title: 'Deletion Process',
          description: `After retention periods expire, personal information is securely deleted or anonymized. Information in backup systems may persist for up to 90 days after deletion from active databases. To request deletion of your data, contact us at ${COMPANY_INFO.email}. We will respond within 30\u201345 days in accordance with applicable law.`,
          note: 'Anonymized or aggregated data may be retained indefinitely. Some information may be retained where we have a legal obligation or legitimate business interest.',
        },
      ],
    },
    {
      title: 'DATA SECURITY',
      description: 'We take the security of your personal information seriously and implement reasonable administrative, technical, and physical safeguards to protect it from unauthorized access, disclosure, alteration, and destruction.',
      subsections: [
        {
          title: 'Security Measures',
          groups: [
            {
              title: 'Technical Safeguards',
              items: [
                'Encryption of data in transit and at rest',
                'Secure socket layer (SSL/TLS) technology',
                'Firewalls and intrusion detection systems',
                'Regular security assessments and vulnerability testing',
              ],
            },
            {
              title: 'Administrative Safeguards',
              items: [
                'Access controls limiting employee access to personal information on a need-to-know basis',
                'Background checks for personnel with access to sensitive data',
                'Security training and awareness programs',
                'Incident response and breach notification procedures',
              ],
            },
          ],
        },
        {
          title: 'Security Limitations',
          description: 'While we strive to protect your information, no method of transmission over the Internet or electronic storage is 100% secure. We cannot guarantee absolute security of your personal information. You are responsible for:',
          items: [
            'Maintaining the confidentiality of your account credentials',
            'Using strong, unique passwords',
            'Logging out of your account when finished',
            'Notifying us immediately of any unauthorized access or security breaches',
          ],
        },
        {
          title: 'Reporting Security Issues',
          description: `If you become aware of any security vulnerability or unauthorized access to your account, please contact us immediately at ${COMPANY_INFO.email}.`,
        },
      ],
    },
    {
      title: 'YOUR PRIVACY RIGHTS AND CHOICES',
      description: 'You have the following rights and choices regarding your personal information:',
      subsections: [
        {
          title: 'Managing Your Account and Information',
          groups: [
            {
              title: 'Access and Updates',
              description: 'Review and update your personal information through your account settings.',
            },
            {
              title: 'Account Closure',
              description: 'Close your account at any time; data will be retained per Section 4.',
            },
          ],
        },
        {
          title: 'Communication Preferences',
          groups: [
            {
              title: 'Marketing Opt-Out',
              description: 'Unsubscribe from promotional emails via the unsubscribe link or account settings.',
            },
            {
              title: 'SMS Opt-Out',
              description: 'Reply "STOP" to text messages or update preferences in account settings.',
            },
            {
              title: 'Transactional Messages',
              description: 'Service-related communications (security alerts, account notifications) cannot be disabled.',
            },
          ],
        },
        {
          title: 'Privacy Controls',
          groups: [
            {
              title: 'Location Tracking',
              description: 'Disable through device or browser settings (may limit certain features).',
            },
            {
              title: 'Cookies',
              description: 'Manage preferences through browser settings.',
            },
          ],
        },
        {
          title: 'Exercising Your Rights',
          description: `To exercise your data rights, contact us at ${COMPANY_INFO.email}. We will respond within 30\u201345 days in accordance with applicable law.`,
        },
        {
          title: 'State-Specific Rights',
          description: 'Residents of certain states (e.g., California, Virginia) may have additional privacy rights under state law.',
        },
      ],
    },
    {
      title: "CHILDREN'S PRIVACY",
      paragraphs: [
        'Our Services are not intended for individuals under the age of 18. We do not knowingly collect, solicit, or maintain personal information from anyone under 18 years of age, nor do we knowingly allow such persons to use our Services.',
        `If we become aware that we have collected personal information from a person under 18 without parental consent, we will delete that information as quickly as possible. If you believe we have collected information from someone under 18, please contact us immediately at ${COMPANY_INFO.email}.`,
        'Parents and guardians should supervise their children\'s online activities and consider using parental control tools to prevent children from providing information without permission.',
      ],
    },
    {
      title: 'CHANGES TO THIS PRIVACY POLICY',
      description: 'We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors.',
      subsections: [
        {
          title: 'Material Changes',
          description: 'If we make material changes that significantly affect your rights or how we handle your personal information, we will notify you by:',
          items: [
            'Posting a prominent notice on our website or application',
            'Sending an email to the address associated with your account',
            'Providing an in-app notification',
          ],
        },
        {
          title: 'Effective Date',
          description: 'Changes become effective on the date specified in the updated Privacy Policy. The "Last Updated" date at the top of this policy indicates when it was most recently revised.',
        },
        {
          title: 'Your Acceptance',
          description: 'By continuing to use our Services after changes become effective, you accept and agree to the updated Privacy Policy. If you do not agree with any changes, you must stop using our Services and may close your account.',
          note: 'We encourage you to review this Privacy Policy periodically to stay informed about how we protect your information.',
        },
      ],
    },
  ],
};

export const TERMS_OF_USE = {
  title: 'Terms of Use',
  effectiveDate: 'December 10, 2025',
  lastUpdated: '01/20/2026',
  intro: `These Terms of Service ("Terms") constitute a legally binding agreement between you and ${COMPANY_INFO.name} ("Sadaora," "${COMPANY_INFO.brandName}," "we," "us," or "our") governing access to and use of the Sadaora platform, the ${COMPANY_INFO.brandName} application, websites, software, mobile apps, APIs, AI systems, and all related services ("Services").`,
  consentNotice: 'By using the Services, you agree to these Terms.',
  sections: [
    {
      title: 'ELIGIBILITY',
      subsections: [
        { description: 'You must be 18 years of age and over.' },
        { description: 'You must have legal capacity to enter into this agreement.' },
        { description: 'Business customers, entrepreneurs, operators of small businesses, and enterprise clients shall be subject to and bound by these Terms in the same manner as individual users, and any use of the Service by or on behalf of such entities constitutes acceptance of these Terms by such entity.' },
      ],
    },
    {
      title: 'SERVICES',
      description: 'Sadaora provides:',
      subsections: [
        {
          items: [
            'AI/ML-powered lifestyle and career insights, guidance and limited recommendations',
            'Career marketplace (future release)',
            'Resume parsing and ML-driven job matching',
            'Community forums, groups, and messaging',
            'Personalized AI model interactions',
            'Email and SMS messaging',
            'Location-based services',
            'Employer dashboards, job posting, and business tools',
            'APIs and partner integrations (LinkedIn, Slack, Zapier, etc.)',
          ],
        },
      ],
      note: 'We reserve the right to add, modify, suspend, or discontinue any features, functions, services, or content, in whole or in part, at any time and from time to time, with or without notice, and without liability to you or any third party.',
    },
    {
      title: 'USER OBLIGATIONS AND ACCOUNT MANAGEMENT',
      subsections: [
        {
          title: 'Accuracy of Information',
          description: 'You must provide true, accurate, current, and complete information when creating your account and using our services. You agree to promptly update any information to maintain its accuracy and completeness.',
        },
        {
          title: 'Credential Security',
          description: 'You are solely responsible for maintaining the confidentiality and security of your account credentials, including passwords, API keys, and authentication tokens. You must not share your credentials with unauthorized parties and should use strong, unique passwords.',
        },
        {
          title: 'Unauthorized Access Notification',
          description: 'You must promptly notify us of any suspected or actual unauthorized access to your account, security breach, or compromise of your credentials. Notification should be made immediately upon discovery through the "Report Bug" button at the bottom of the navigation menu.',
        },
        {
          title: 'Account Suspension and Termination',
          description: 'We reserve the right to suspend, restrict, or terminate your account at any time, with or without notice, for violations of these terms, misuse of our services, or any conduct we determine to be harmful to our systems, other users, or our business interests.',
        },
      ],
    },
    {
      title: 'DATA COLLECTION & PRIVACY',
      paragraphs: [
        'Your use of the Services and all matters relating to privacy and data protection are governed exclusively by our Privacy Policy, as may be amended from time to time, which is incorporated into and made part of these Terms.',
      ],
      description: 'We collect:',
      subsections: [
        {
          items: [
            'Personal information (name, email, calendar, to-do lists, goals/milestones, and demographics, etc.)',
            'Business information (name, email, calendar, to-do lists, goals/milestones, and demographics, etc.)',
            'Career info, work history, preferences',
            'Behavioral and usage data',
            'Education, achievement, knowledge data',
            'Uploaded content (resumes, documents, and images, etc.)',
            'Travel and location data',
            'Sensitive personal data (as needed)',
          ],
        },
        {
          title: 'Payment Information',
          description: 'All payment transactions are processed through our third-party payment service provider, Stripe, Inc. ("Stripe"). Your payment information is transmitted directly to and stored by Stripe in accordance with Stripe\'s privacy policy and terms of service. We do not have access to or store your complete payment card details.',
        },
      ],
      note: 'Anonymized, de-identified, and/or aggregated data derived from your use of the Services may be shared with analytics providers, research partners, and other third parties at our sole discretion for business, analytical, research, and marketing purposes.',
    },
    {
      title: 'AI SYSTEM DISCLAIMERS AND DATA USAGE',
      description: 'You acknowledge:',
      subsections: [
        {
          title: 'Output Limitations',
          description: 'AI-generated outputs are probabilistic in nature and may contain errors, omissions, or inaccuracies. Users should independently verify all AI-generated information before relying on it for any purpose.',
        },
        {
          title: 'Professional Advice Exclusion',
          description: 'AI outputs are provided for informational purposes only and do not constitute professional advice. Users must not rely on AI outputs as a substitute for professional legal, medical, financial, or behavioral health advice, diagnosis, or treatment. Always consult qualified professionals for decisions in these domains.',
        },
        {
          title: 'Personalization Notice',
          description: 'The AI system may personalize recommendations and outputs based on your user data, including but not limited to your preferences, usage history, and provided information.',
        },
        {
          title: 'Content Usage for System Improvement',
          description: 'Content you upload or submit may be used to train, evaluate, and improve our AI systems and services, subject to our Privacy Policy and applicable data protection laws.',
        },
      ],
    },
    {
      title: 'USER CONTENT',
      subsections: [
        {
          title: 'Ownership Rights',
          description: 'You retain all intellectual property rights and ownership in any content you upload, submit, or otherwise provide to Sadaora ("User Content"). Nothing in these Terms transfers ownership of your User Content to Sadaora.',
        },
        {
          title: 'License Grant',
          description: 'By uploading User Content, you grant Sadaora a non-exclusive, worldwide, royalty-free, sublicensable, and transferable license to use, reproduce, process, adapt, modify, publish, transmit, display, and distribute your User Content solely to operate, provide, maintain, improve, and develop our Services, including training and enhancing our AI systems.',
        },
        {
          title: 'Content Privacy',
          description: 'We will not publicly display, share, or distribute your User Content to third parties without your express authorization, except as necessary to provide the Services or as required by law. Your content remains private subject to our Privacy Policy.',
        },
        {
          title: 'Content Removal',
          description: 'We reserve the right to review, monitor, and remove any User Content that violates these Terms, infringes intellectual property rights, contains illegal material, or is otherwise harmful or objectionable, at our sole discretion and without prior notice.',
        },
      ],
    },
    {
      title: 'LICENSE & PROHIBITED USES',
      subsections: [
        {
          title: 'License Grant',
          description: 'Subject to your compliance with these Terms, Sadaora grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Services for your personal or internal business purposes in accordance with these Terms and our documentation.',
        },
        {
          title: 'Prohibited Activities',
          description: 'You must not:',
          groups: [
            {
              title: 'Misuse AI Outputs',
              description: 'Present AI content as human-created without disclosure; use for professional decisions without expert review; redistribute commercially without authorization.',
            },
            {
              title: 'Harass or Harm',
              description: 'Engage in harassment, bullying, hate speech, threats, or abuse.',
            },
            {
              title: 'Break Laws',
              description: 'Conduct illegal activities; infringe intellectual property; distribute CSAM; commit fraud.',
            },
            {
              title: 'Scrape Data',
              description: 'Use automated tools to harvest data; circumvent technical restrictions; exceed rate limits.',
            },
            {
              title: 'Impersonate Others',
              description: 'Falsely represent yourself as another person or entity; use fraudulent information.',
            },
            {
              title: 'Upload Malicious Code',
              description: 'Distribute viruses, malware, or code that disrupts or damages systems.',
            },
            {
              title: 'Reverse Engineer',
              description: 'Decompile, disassemble, or extract source code from our Services; build competing products.',
            },
            {
              title: 'Use Bots Improperly',
              description: 'Access Services with unauthorized automated tools; create multiple accounts via automation.',
            },
            {
              title: 'Generate Harmful Content',
              description: 'Create content promoting violence, discrimination, self-harm, dangerous activities, or explicit content involving minors.',
            },
          ],
          note: 'Violations may result in account termination, legal action, and law enforcement reporting.',
        },
        {
          title: 'Consequences of Violations',
          description: 'Violation of these prohibited uses may result in:',
          items: [
            'Immediate suspension or termination of your account',
            'Removal of violating content',
            'Legal action and liability for damages',
            'Reporting to law enforcement authorities where appropriate',
            'Permanent ban from our Services',
          ],
        },
        {
          title: 'Reservation of Rights',
          description: 'We reserve the right to investigate suspected violations and to take appropriate action, including but not limited to removing content, suspending accounts, and cooperating with law enforcement. We are not obligated to monitor User Content but may do so to enforce these Terms.',
        },
      ],
    },
    {
      title: 'PAYMENT & BILLING',
      subsections: [
        {
          title: 'Subscription Plans',
          description: `Sadaora offers the following subscription plans for access to the Service. Current pricing and details are available on our website at ${COMPANY_INFO.website}.`,
          groups: [
            {
              title: 'Monthly Subscription',
              description: 'Billed on the same date of every month on a recurring basis.',
            },
            {
              title: 'Annual Subscription',
              description: 'Billed on the same date every year (12 months) on a recurring basis.',
            },
          ],
        },
        {
          title: 'Auto-Renewal',
          description: 'YOUR SUBSCRIPTION WILL AUTOMATICALLY RENEW AT THE END OF EACH SUBSCRIPTION PERIOD (MONTHLY OR ANNUAL) UNLESS YOU CANCEL BEFORE THE NEXT RENEWAL DATE. By subscribing, you authorize Sadaora to charge your payment method automatically on each renewal date for the then-current subscription fee, plus any applicable taxes.',
          isUpperCase: true,
        },
        {
          title: 'Cancellations',
          description: `You may cancel your subscription at any time by accessing your account settings under the subscription tab or contacting customer support at ${COMPANY_INFO.supportEmail}. Cancellations will be effective at the end of your current billing period. (For annual subscriptions, cancellations take effect at the end of the current month.) You will retain access to the service until the end of the paid period unless stated otherwise.`,
          note: 'No refunds will be provided for partial subscription periods.',
        },
        {
          title: 'Price Changes',
          description: 'Sadaora reserves the right to change subscription prices at any time. Price changes will take effect at the start of your next subscription period following notice of the change. We will provide at least thirty (30) days\' advance notice of any price increases via email or through the Services.',
        },
        {
          title: 'Monthly Subscription Refunds',
          groups: [
            {
              title: 'Eligibility',
              description: 'Refunds are available within fourteen (14) days of the payment date, where transactions have met the requirements to be refunded.',
            },
            {
              title: 'Access',
              description: 'Upon approval of your refund, you will retain full access to the Services until the end of your current monthly billing period. Your subscription will not be renewed.',
            },
            {
              title: 'Process',
              description: `To receive a refund, select the "cancel subscription" button within Account > Subscription, or request refunds by contacting ${COMPANY_INFO.supportEmail} with your account details and reason for refund.`,
            },
            {
              title: 'Processing Time',
              description: 'Refunds are processed within 10\u201315 business days to your original payment method.',
            },
            {
              title: 'Limitations',
              description: 'Only one refund per customer per 12-month period for monthly subscriptions.',
            },
          ],
        },
        {
          title: 'Annual Subscription Refunds',
          groups: [
            {
              title: 'Eligibility',
              description: 'Refunds are available within sixty (60) days of the annual payment date.',
            },
            {
              title: 'Access',
              description: 'Upon approval of your refund, you will retain full access to the Services until the end of the current month (12 months from original payment date). Your subscription will not be renewed.',
            },
            {
              title: 'Partial Refunds',
              description: 'After 60 days, no refunds are available, but you may cancel to prevent future charges at your renewal date.',
            },
            {
              title: 'Process',
              description: `Request refunds by contacting ${COMPANY_INFO.supportEmail}.`,
            },
            {
              title: 'Processing Time',
              description: 'Refunds are processed within 10\u201315 business days to your original payment method.',
            },
          ],
        },
        {
          title: 'Refund Exclusions',
          description: 'Refunds are not available for:',
          items: [
            'Accounts terminated for Terms violations',
            'Purchases made more than 60 days ago (annual) or 14 days ago (monthly)',
            'Add-on services or one-time purchases (unless otherwise specified)',
            'Third-party services or integrations',
            'Multiple refund requests within a 12-month period (for monthly plans)',
          ],
        },
        {
          title: 'Effect of Refund',
          description: 'When a refund is approved:',
          items: [
            'Your payment method will be credited within 10\u201315 business days',
            'Your subscription is automatically canceled and will not auto-renew',
            'You retain full access to paid features until the end of your current billing period',
            'After the period ends, your account converts to a free plan (if available), or features are restricted to free tier',
          ],
        },
        {
          title: 'Discretionary Refunds',
          description: 'We may, at our sole discretion, offer refunds outside these policies for:',
          items: [
            'Extended service outages or technical issues',
            'Billing errors or duplicate charges',
            'Other extenuating circumstances',
          ],
          note: 'These discretionary refunds are evaluated case-by-case and do not establish a precedent for future requests.',
        },
      ],
      note: 'All payment transactions are processed through our third-party payment service provider, Stripe, Inc. ("Stripe"). Your payment information is transmitted directly to and stored by Stripe in accordance with Stripe\'s privacy policy and terms of service. We do not have access to or store your complete payment card details.',
    },
    {
      title: 'ACCOUNT SUSPENSION AND TERMINATION',
      description: 'We reserve the right to suspend, restrict, or terminate your account and access to the Services, with or without prior notice, under the following circumstances:',
      subsections: [
        {
          title: 'Violation of Terms',
          description: 'Breach of these Terms, our policies, or community guidelines.',
        },
        {
          title: 'Security Risks',
          description: 'Activities that compromise or threaten the security, integrity, or availability of our Services, systems, or network.',
        },
        {
          title: 'Harmful Conduct',
          description: 'Behavior that harms, or poses risk of harm to, other users, our community, or Sadaora.',
        },
        {
          title: 'Legal Compliance',
          description: 'When required by law, court order, or regulatory authority, or to prevent legal liability.',
        },
        {
          title: 'Fraudulent Activity',
          description: 'Use of stolen payment methods, identity fraud, or other deceptive practices.',
        },
        {
          title: 'Notice and Appeal',
          items: [
            'Where practicable, we will provide notice of suspension or termination and the reason(s) for such action',
            `For permanent terminations based on terms violations, you may submit an appeal within 30 days to ${COMPANY_INFO.email}`,
            'Suspensions or terminations for legal, security, or safety reasons may be immediate and without prior notice',
          ],
        },
        {
          title: 'Upon Termination',
          description: 'We may take such actions as we determine, in our sole and absolute discretion, to be necessary or appropriate to protect the integrity of the Application, network security, community standards, user safety, or our legal rights and obligations.',
        },
        {
          title: 'Data Retention',
          description: 'Personal data and account information will be retained for three (3) years following account termination or your last use of the Services, whichever is later, except where:',
          items: [
            'Longer retention is required by applicable law, regulation, or legal process',
            'Shorter retention is requested by you and permitted under applicable law',
            'Retention is necessary for legitimate business purposes, including dispute resolution and enforcement of our agreements',
          ],
        },
      ],
    },
    {
      title: 'INTELLECTUAL PROPERTY',
      description: 'Sadaora owns and retains all rights, title, and interest in and to:',
      subsections: [
        {
          items: [
            'All artificial intelligence models, algorithms, and machine learning technologies',
            'All software, source code, design, trademarks, service marks, logos, and trade dress',
            'All content, materials, and data available on or through the platform',
            'All intellectual property rights associated with the foregoing',
          ],
        },
      ],
      note: "Any use, reproduction, modification, or distribution of Sadaora's intellectual property requires prior written consent from Sadaora's Chief Executive Officer or authorized designee.",
    },
    {
      title: 'THIRD-PARTY SERVICES',
      paragraphs: [
        'Sadaora integrates with certain third-party service providers, including, but not limited to: LinkedIn, Slack, Stripe, Zapier, and various analytics providers. Each third-party integration is subject to that provider\'s own terms and conditions and privacy policies. Sadaora makes no representations or warranties regarding Third-Party Services and shall not be liable for any damages or losses arising from your use thereof.',
      ],
    },
    {
      title: 'LIMITATION OF LIABILITY',
      subsections: [
        {
          title: 'AS-IS Provision',
          description: 'The Services are provided on an "AS IS" and "AS AVAILABLE" basis, without warranties of any kind, either express or implied.',
        },
        {
          title: 'Disclaimer of Warranties',
          description: 'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SADAORA DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.',
          isUpperCase: true,
        },
        {
          title: 'Cap on Liability',
          description: "IN NO EVENT SHALL SADAORA'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICES EXCEED THE TOTAL AMOUNT PAID BY YOU TO SADAORA IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO LIABILITY.",
          isUpperCase: true,
        },
        {
          title: 'Exclusion of Damages',
          description: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, SADAORA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, LOSS OF PROFITS, LOSS OF REVENUE, BUSINESS INTERRUPTION, OR INACCURACIES IN AI-GENERATED CONTENT OR OUTPUTS, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, EVEN IF SADAORA HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.',
          isUpperCase: true,
        },
      ],
    },
    {
      title: 'DISPUTE RESOLUTION',
      subsections: [
        {
          title: 'Binding Arbitration',
          description: 'Any dispute, claim, or controversy arising out of or relating to these Terms or the Services (collectively, "Disputes") shall be resolved by binding arbitration administered by the American Arbitration Association ("AAA") under its Commercial Arbitration Rules, except as modified by these Terms. The arbitration shall be conducted by a single arbitrator and shall take place in New Castle County, Delaware. The arbitrator\'s decision shall be final and binding, and judgment on the award may be entered in any court having jurisdiction.',
        },
        {
          title: 'Class Action Waiver',
          description: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, YOU AND SADAORA AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, CONSOLIDATED, OR REPRESENTATIVE PROCEEDING. Unless both you and Sadaora agree otherwise in writing, the arbitrator may not consolidate more than one person\'s claims and may not otherwise preside over any form of representative or class proceeding.',
          isUpperCase: true,
        },
        {
          title: 'Governing Law',
          description: 'These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law principles.',
        },
        {
          title: 'California Consumer Rights',
          description: 'If you are a California resident, you retain all rights provided under California law, including those under the California Consumer Privacy Act (CCPA). Nothing in this arbitration provision shall be deemed to waive any rights you may have under California consumer protection laws that cannot be waived by agreement.',
        },
      ],
    },
    {
      title: 'AMENDMENTS',
      paragraphs: [
        'Sadaora reserves the right to modify, amend, or update these Terms at any time in its sole discretion. We will provide notice of material changes by posting the updated Terms on our website and updating the "Last Updated" date at the top of these Terms. Your continued use of the Services after any such changes constitutes your acceptance of the revised Terms. If you do not agree to the amended Terms, you must discontinue use of the Services.',
      ],
    },
  ],
};
