/**
 * Campaign Templates Module
 * Professional HTML email templates for marketing campaigns
 * Each template includes responsive HTML/CSS design with personalization tokens
 */

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: 'seasonal' | 'discount' | 'service' | 'followup' | 'holiday' | 'newsletter' | 'announcement';
  thumbnail: string; // CSS gradient/color for preview card
  previewText: string;
  defaultSubject: string;
  htmlBody: string;
  tags: string[];
}

// Helper function to wrap content in a professional email layout
function wrapInEmailLayout(content: string, accentColor: string = '#1e40af', headerBg: string = 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)'): string {
  return `<div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:${headerBg};padding:32px 24px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Square 15</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;font-weight:400;">Property Maintenance</p>
  </div>
  ${content}
  <div style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#64748b;font-size:13px;margin:0;">Square 15 Property Maintenance</p>
    <p style="color:#64748b;font-size:12px;margin:8px 0 0;">📞 Contact us | 🌐 www.square15.co.za</p>
    <p style="color:#94a3b8;font-size:11px;margin:12px 0 0;">You received this email because you're a valued customer of Square 15.</p>
  </div>
</div>`;
}

export const campaignTemplates: CampaignTemplate[] = [
  // ===========================================
  // DISCOUNT TEMPLATES
  // ===========================================
  {
    id: 'discount-percentage',
    name: 'Percentage Discount Offer',
    description: 'Eye-catching discount campaign with bold percentage display and call-to-action',
    category: 'discount',
    thumbnail: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
    previewText: 'Special discount on our services - limited time!',
    defaultSubject: '🔥 Special Offer: Save on {{serviceType}} Services!',
    tags: ['discount', 'promotion', 'sales'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;text-align:center;">
    <div style="background:linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%);border-radius:16px;padding:32px;margin-bottom:24px;">
      <p style="color:#dc2626;font-size:16px;font-weight:600;margin:0 0 8px;text-transform:uppercase;letter-spacing:2px;">Limited Time Offer</p>
      <div style="font-size:72px;font-weight:800;color:#dc2626;line-height:1;margin:8px 0;">10%</div>
      <p style="color:#ea580c;font-size:20px;font-weight:600;margin:8px 0 0;">OFF ALL SERVICES</p>
    </div>
    <h2 style="color:#1e293b;font-size:22px;margin:0 0 12px;">Hi {{customerName}},</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
      We're excited to offer you an exclusive discount on our {{serviceType}} services!
      Whether it's a small repair or a major project, now is the perfect time to get it done.
    </p>
    <a href="https://www.square15.co.za" style="display:inline-block;background:linear-gradient(135deg, #dc2626 0%, #ea580c 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
      Claim Your Discount →
    </a>
    <p style="color:#94a3b8;font-size:13px;margin:16px 0 0;">*Offer valid for a limited time. Terms & conditions apply.</p>
  </div>`, '#dc2626', 'linear-gradient(135deg, #dc2626 0%, #ea580c 100%)')
  },

  {
    id: 'discount-bundle',
    name: 'Service Bundle Deal',
    description: 'Promote bundled services at a special price with feature highlights',
    category: 'discount',
    thumbnail: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
    previewText: 'Bundle & save on multiple property services',
    defaultSubject: '💰 Bundle & Save: Complete Property Maintenance Package',
    tags: ['bundle', 'discount', 'package'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;">
    <h2 style="color:#1e293b;font-size:22px;margin:0 0 8px;text-align:center;">Hi {{customerName}},</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;text-align:center;margin:0 0 24px;">
      Get more done for less with our special maintenance bundle!
    </p>
    <div style="background:linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%);border-radius:12px;padding:24px;margin-bottom:24px;">
      <h3 style="color:#059669;font-size:18px;margin:0 0 16px;text-align:center;">🏠 Complete Property Package</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#374151;font-size:14px;">✅ General Inspection</td><td style="text-align:right;color:#059669;font-weight:600;">Included</td></tr>
        <tr><td style="padding:8px 0;color:#374151;font-size:14px;border-top:1px solid #d1fae5;">✅ Plumbing Check</td><td style="text-align:right;color:#059669;font-weight:600;border-top:1px solid #d1fae5;">Included</td></tr>
        <tr><td style="padding:8px 0;color:#374151;font-size:14px;border-top:1px solid #d1fae5;">✅ Electrical Safety Audit</td><td style="text-align:right;color:#059669;font-weight:600;border-top:1px solid #d1fae5;">Included</td></tr>
        <tr><td style="padding:8px 0;color:#374151;font-size:14px;border-top:1px solid #d1fae5;">✅ Painting Touch-ups</td><td style="text-align:right;color:#059669;font-weight:600;border-top:1px solid #d1fae5;">Included</td></tr>
      </table>
    </div>
    <div style="text-align:center;">
      <a href="https://www.square15.co.za" style="display:inline-block;background:linear-gradient(135deg, #059669 0%, #0d9488 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Get Your Bundle Quote →
      </a>
    </div>
  </div>`, '#059669', 'linear-gradient(135deg, #059669 0%, #0d9488 100%)')
  },

  // ===========================================
  // SEASONAL TEMPLATES
  // ===========================================
  {
    id: 'seasonal-summer',
    name: 'Summer Maintenance Special',
    description: 'Bright, warm summer-themed campaign for seasonal property services',
    category: 'seasonal',
    thumbnail: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    previewText: 'Get your property summer-ready!',
    defaultSubject: '☀️ Summer Special: Get Your Property Ready for the Season!',
    tags: ['summer', 'seasonal', 'maintenance'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:8px;">☀️</div>
      <h2 style="color:#1e293b;font-size:24px;margin:0 0 8px;">Summer Is Here, {{customerName}}!</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">
        Is your property ready for the summer season? Don't let small issues turn into big problems.
      </p>
    </div>
    <div style="display:grid;gap:12px;margin-bottom:24px;">
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;border-radius:0 8px 8px 0;">
        <h4 style="color:#92400e;margin:0 0 4px;font-size:15px;">🎨 Exterior Painting</h4>
        <p style="color:#78716c;margin:0;font-size:13px;">Refresh your property's curb appeal before the holiday season</p>
      </div>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;border-radius:0 8px 8px 0;">
        <h4 style="color:#991b1b;margin:0 0 4px;font-size:15px;">🔧 HVAC Servicing</h4>
        <p style="color:#78716c;margin:0;font-size:13px;">Keep cool all summer with a professional AC check-up</p>
      </div>
      <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:16px;border-radius:0 8px 8px 0;">
        <h4 style="color:#065f46;margin:0 0 4px;font-size:15px;">🏠 General Maintenance</h4>
        <p style="color:#78716c;margin:0;font-size:13px;">Complete property inspection and fix-up service</p>
      </div>
    </div>
    <div style="text-align:center;">
      <a href="https://www.square15.co.za" style="display:inline-block;background:linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Book Your Summer Service →
      </a>
    </div>
  </div>`, '#f59e0b', 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)')
  },

  {
    id: 'seasonal-winter',
    name: 'Winter Preparation Campaign',
    description: 'Professional winter prep campaign to protect properties from cold weather',
    category: 'seasonal',
    thumbnail: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    previewText: 'Prepare your property for winter',
    defaultSubject: '🌧️ Winter Is Coming: Protect Your Property Now!',
    tags: ['winter', 'seasonal', 'preparation'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:8px;">🌧️</div>
      <h2 style="color:#1e293b;font-size:24px;margin:0 0 8px;">Winter Prep Time, {{customerName}}!</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">
        Cold weather and rain can damage unprepared properties. Let us help you winterize your home or building.
      </p>
    </div>
    <div style="background:linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%);border-radius:12px;padding:24px;margin-bottom:24px;">
      <h3 style="color:#1e40af;font-size:16px;margin:0 0 16px;">Our Winter Protection Services:</h3>
      <div style="margin-bottom:12px;"><span style="color:#3b82f6;font-weight:600;">🔍 Roof Inspection</span><br><span style="color:#6b7280;font-size:13px;">Check for leaks, damaged tiles, and waterproofing</span></div>
      <div style="margin-bottom:12px;"><span style="color:#3b82f6;font-weight:600;">🚿 Plumbing Check</span><br><span style="color:#6b7280;font-size:13px;">Prevent frozen or burst pipes this winter</span></div>
      <div style="margin-bottom:12px;"><span style="color:#3b82f6;font-weight:600;">⚡ Electrical Safety</span><br><span style="color:#6b7280;font-size:13px;">Ensure heaters and electrical systems are safe</span></div>
      <div><span style="color:#3b82f6;font-weight:600;">🏗️ Structural Repairs</span><br><span style="color:#6b7280;font-size:13px;">Fix cracks and gaps before rain season</span></div>
    </div>
    <div style="text-align:center;">
      <a href="https://www.square15.co.za" style="display:inline-block;background:linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Schedule Winter Prep →
      </a>
    </div>
  </div>`, '#3b82f6', 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)')
  },

  // ===========================================
  // SERVICE-SPECIFIC TEMPLATES
  // ===========================================
  {
    id: 'service-plumbing',
    name: 'Plumbing Services Spotlight',
    description: 'Dedicated plumbing services promotion with professional imagery',
    category: 'service',
    thumbnail: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
    previewText: 'Professional plumbing solutions at your service',
    defaultSubject: '🔧 Professional Plumbing Services - Quick & Reliable!',
    tags: ['plumbing', 'service', 'maintenance'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;">
    <div style="background:linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <div style="font-size:40px;margin-bottom:8px;">🔧</div>
      <h2 style="color:#ffffff;font-size:22px;margin:0;">Expert Plumbing Services</h2>
      <p style="color:rgba(255,255,255,0.9);font-size:14px;margin:8px 0 0;">Fast. Reliable. Professional.</p>
    </div>
    <h3 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Hi {{customerName}},</h3>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
      From leaky taps to full bathroom renovations, our experienced plumbing team handles it all.
    </p>
    <div style="margin-bottom:24px;">
      <div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f1f5f9;">
        <span style="background:#dbeafe;color:#1e40af;width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;margin-right:12px;">💧</span>
        <div><strong style="color:#1e293b;font-size:14px;">Leak Repairs</strong><br><span style="color:#64748b;font-size:12px;">Quick detection and permanent fixes</span></div>
      </div>
      <div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f1f5f9;">
        <span style="background:#dbeafe;color:#1e40af;width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;margin-right:12px;">🚿</span>
        <div><strong style="color:#1e293b;font-size:14px;">Bathroom & Kitchen</strong><br><span style="color:#64748b;font-size:12px;">Full renovations and installations</span></div>
      </div>
      <div style="display:flex;align-items:center;padding:12px 0;">
        <span style="background:#dbeafe;color:#1e40af;width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;margin-right:12px;">🏗️</span>
        <div><strong style="color:#1e293b;font-size:14px;">New Installations</strong><br><span style="color:#64748b;font-size:12px;">Geysers, pipes, drainage systems</span></div>
      </div>
    </div>
    <div style="text-align:center;">
      <a href="https://www.square15.co.za" style="display:inline-block;background:linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Get a Free Plumbing Quote →
      </a>
    </div>
  </div>`, '#0ea5e9', 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)')
  },

  {
    id: 'service-electrical',
    name: 'Electrical Services Campaign',
    description: 'Professional electrical services promotion with safety focus',
    category: 'service',
    thumbnail: 'linear-gradient(135deg, #eab308 0%, #f59e0b 100%)',
    previewText: 'Licensed electrical services for your safety',
    defaultSubject: '⚡ Electrical Services: Safety First, Always!',
    tags: ['electrical', 'service', 'safety'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;">
    <div style="background:linear-gradient(135deg, #fefce8 0%, #fffbeb 100%);border:2px solid #fbbf24;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <div style="font-size:40px;margin-bottom:8px;">⚡</div>
      <h2 style="color:#92400e;font-size:22px;margin:0;">Certified Electrical Services</h2>
      <p style="color:#a16207;font-size:14px;margin:8px 0 0;">Your safety is our priority</p>
    </div>
    <h3 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Hi {{customerName}},</h3>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
      Don't take chances with electrical work. Our certified electricians ensure your property meets all safety standards.
    </p>
    <table style="width:100%;border-collapse:separate;border-spacing:0 8px;">
      <tr><td style="background:#fef9c3;padding:12px 16px;border-radius:8px;"><strong style="color:#713f12;">🔌 Wiring & Rewiring</strong> - Complete electrical installations</td></tr>
      <tr><td style="background:#fef9c3;padding:12px 16px;border-radius:8px;"><strong style="color:#713f12;">💡 Lighting Solutions</strong> - Indoor, outdoor & decorative lighting</td></tr>
      <tr><td style="background:#fef9c3;padding:12px 16px;border-radius:8px;"><strong style="color:#713f12;">🛡️ Safety Inspections</strong> - COC certificates & compliance checks</td></tr>
      <tr><td style="background:#fef9c3;padding:12px 16px;border-radius:8px;"><strong style="color:#713f12;">🔋 Backup Power</strong> - Generator & inverter installations</td></tr>
    </table>
    <div style="text-align:center;margin-top:24px;">
      <a href="https://www.square15.co.za" style="display:inline-block;background:linear-gradient(135deg, #eab308 0%, #f59e0b 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Book an Electrical Service →
      </a>
    </div>
  </div>`, '#eab308', 'linear-gradient(135deg, #eab308 0%, #f59e0b 100%)')
  },

  {
    id: 'service-painting',
    name: 'Painting & Renovation Campaign',
    description: 'Colorful painting services promotion with before/after concept',
    category: 'service',
    thumbnail: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
    previewText: 'Transform your space with professional painting',
    defaultSubject: '🎨 Transform Your Space: Professional Painting Services',
    tags: ['painting', 'renovation', 'interior'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:8px;">🎨</div>
      <h2 style="color:#1e293b;font-size:24px;margin:0 0 8px;">Fresh Paint, Fresh Start!</h2>
      <p style="color:#475569;font-size:15px;margin:0;">Hi {{customerName}}, transform your property with a professional paint job.</p>
    </div>
    <div style="display:grid;gap:16px;margin-bottom:24px;">
      <div style="background:linear-gradient(135deg, #faf5ff 0%, #fdf2f8 100%);border-radius:12px;padding:20px;text-align:center;">
        <h4 style="color:#7c3aed;margin:0 0 8px;">🏠 Interior Painting</h4>
        <p style="color:#6b7280;font-size:13px;margin:0;">Walls, ceilings, trim work - complete interior transformation</p>
      </div>
      <div style="background:linear-gradient(135deg, #faf5ff 0%, #fdf2f8 100%);border-radius:12px;padding:20px;text-align:center;">
        <h4 style="color:#db2777;margin:0 0 8px;">🏗️ Exterior Painting</h4>
        <p style="color:#6b7280;font-size:13px;margin:0;">Weather-resistant finishes for lasting curb appeal</p>
      </div>
      <div style="background:linear-gradient(135deg, #faf5ff 0%, #fdf2f8 100%);border-radius:12px;padding:20px;text-align:center;">
        <h4 style="color:#a855f7;margin:0 0 8px;">✨ Specialty Finishes</h4>
        <p style="color:#6b7280;font-size:13px;margin:0;">Texture coats, feature walls, geometric patterns</p>
      </div>
    </div>
    <div style="text-align:center;">
      <a href="https://www.square15.co.za" style="display:inline-block;background:linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Get a Free Color Consultation →
      </a>
    </div>
  </div>`, '#8b5cf6', 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)')
  },

  // ===========================================
  // FOLLOW-UP TEMPLATES
  // ===========================================
  {
    id: 'followup-quote',
    name: 'Quote Follow-Up',
    description: 'Professional follow-up email for customers who received a quotation',
    category: 'followup',
    thumbnail: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
    previewText: 'Following up on your recent quote',
    defaultSubject: '📋 Following Up on Your Quote - Ready When You Are!',
    tags: ['followup', 'quote', 'conversion'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;">
    <h2 style="color:#1e293b;font-size:22px;margin:0 0 12px;">Hi {{customerName}},</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      We recently sent you a quotation for {{serviceType}} services and wanted to check in.
    </p>
    <div style="background:linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%);border-radius:12px;padding:24px;margin-bottom:24px;">
      <h3 style="color:#0d9488;font-size:16px;margin:0 0 12px;">Why Choose Square 15?</h3>
      <ul style="color:#475569;font-size:14px;line-height:2;margin:0;padding-left:20px;">
        <li>✓ Professional, experienced team</li>
        <li>✓ Competitive pricing with no hidden costs</li>
        <li>✓ Quality workmanship guaranteed</li>
        <li>✓ Flexible scheduling to suit you</li>
      </ul>
    </div>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Have questions about the quote? Need adjustments? We're here to help!
    </p>
    <div style="text-align:center;">
      <a href="https://www.square15.co.za" style="display:inline-block;background:linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Let's Get Started →
      </a>
    </div>
  </div>`, '#14b8a6', 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)')
  },

  {
    id: 'followup-inactive',
    name: 'Re-engagement Campaign',
    description: 'Win back inactive customers with a compelling return offer',
    category: 'followup',
    thumbnail: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    previewText: 'We miss you! Come back with a special offer',
    defaultSubject: '💝 We Miss You, {{customerName}}! Here\'s Something Special',
    tags: ['reengagement', 'winback', 'inactive'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;text-align:center;">
    <div style="font-size:48px;margin-bottom:8px;">💝</div>
    <h2 style="color:#1e293b;font-size:24px;margin:0 0 8px;">We Miss You, {{customerName}}!</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
      It's been a while since we last worked together. We'd love the chance to help you again 
      with your property maintenance needs.
    </p>
    <div style="background:linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="color:#e11d48;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Welcome Back Offer</p>
      <div style="font-size:48px;font-weight:800;color:#e11d48;line-height:1;">15% OFF</div>
      <p style="color:#9f1239;font-size:16px;margin:8px 0 0;">Your Next Service</p>
    </div>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Simply reply to this email or give us a call to claim your special discount.
    </p>
    <a href="https://www.square15.co.za" style="display:inline-block;background:linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
      Reconnect With Us →
    </a>
  </div>`, '#e11d48', 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)')
  },

  // ===========================================
  // NEWSLETTER TEMPLATE
  // ===========================================
  {
    id: 'newsletter-monthly',
    name: 'Monthly Newsletter',
    description: 'Clean monthly newsletter with company updates, tips, and CTA',
    category: 'newsletter',
    thumbnail: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)',
    previewText: 'Your monthly property maintenance update',
    defaultSubject: '📬 Square 15 Monthly Update - Tips, News & Offers',
    tags: ['newsletter', 'monthly', 'update'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;">
    <h2 style="color:#1e293b;font-size:22px;margin:0 0 12px;">Hello {{customerName}},</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Here's your monthly property maintenance update from Square 15. Stay informed and keep your property in top shape!
    </p>
    
    <div style="border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:20px;">
      <h3 style="color:#1e40af;font-size:16px;margin:0 0 8px;">📰 Company News</h3>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0;">
        We've expanded our team and added new services! Check out our latest capabilities on our website.
      </p>
    </div>
    
    <div style="border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:20px;">
      <h3 style="color:#7c3aed;font-size:16px;margin:0 0 8px;">💡 Pro Tip of the Month</h3>
      <div style="background:#f8fafc;border-radius:8px;padding:16px;">
        <p style="color:#475569;font-size:14px;line-height:1.6;margin:0;">
          <strong>Regular maintenance saves money!</strong> A simple annual inspection can prevent 80% of emergency repairs. 
          Schedule your inspection today and avoid costly surprises.
        </p>
      </div>
    </div>
    
    <div style="margin-bottom:24px;">
      <h3 style="color:#059669;font-size:16px;margin:0 0 8px;">🎁 This Month's Special</h3>
      <div style="background:linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);border-radius:8px;padding:16px;">
        <p style="color:#065f46;font-size:14px;line-height:1.6;margin:0;">
          Book any two services this month and get <strong>10% off</strong> the total! 
          Use code: <strong style="background:#d1fae5;padding:2px 8px;border-radius:4px;">SQ15DOUBLE</strong>
        </p>
      </div>
    </div>
    
    <div style="text-align:center;">
      <a href="https://www.square15.co.za" style="display:inline-block;background:linear-gradient(135deg, #1e40af 0%, #7c3aed 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Visit Our Website →
      </a>
    </div>
  </div>`)
  },

  // ===========================================
  // HOLIDAY TEMPLATES
  // ===========================================
  {
    id: 'holiday-festive',
    name: 'Festive Season Greetings',
    description: 'Warm holiday greetings with a subtle service promotion',
    category: 'holiday',
    thumbnail: 'linear-gradient(135deg, #dc2626 0%, #16a34a 100%)',
    previewText: 'Season\'s greetings from Square 15!',
    defaultSubject: '🎄 Happy Holidays from Square 15 Property Maintenance!',
    tags: ['holiday', 'christmas', 'festive', 'greetings'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;text-align:center;">
    <div style="font-size:48px;margin-bottom:8px;">🎄✨🎁</div>
    <h2 style="color:#1e293b;font-size:24px;margin:0 0 8px;">Season's Greetings!</h2>
    <h3 style="color:#475569;font-size:18px;font-weight:400;margin:0 0 20px;">Happy Holidays, {{customerName}}</h3>
    <div style="background:linear-gradient(135deg, #fef2f2 0%, #f0fdf4 100%);border-radius:12px;padding:24px;margin-bottom:24px;">
      <p style="color:#475569;font-size:15px;line-height:1.8;margin:0;">
        As the year comes to a close, we'd like to thank you for choosing Square 15 Property Maintenance.
        Your trust means the world to us, and we look forward to serving you in the new year!
      </p>
    </div>
    <div style="background:#fffbeb;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="color:#92400e;font-size:14px;margin:0;">
        🎁 <strong>New Year Special:</strong> Book your January maintenance now and save 10%!
      </p>
    </div>
    <p style="color:#475569;font-size:16px;font-weight:500;margin:0;">
      Wishing you a wonderful holiday season! 🎉
    </p>
    <p style="color:#94a3b8;font-size:14px;margin:12px 0 0;">
      — The Square 15 Team
    </p>
  </div>`, '#dc2626', 'linear-gradient(135deg, #dc2626 0%, #16a34a 100%)')
  },

  // ===========================================
  // ANNOUNCEMENT TEMPLATE
  // ===========================================
  {
    id: 'announcement-new-service',
    name: 'New Service Announcement',
    description: 'Professional announcement for new services or capabilities',
    category: 'announcement',
    thumbnail: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    previewText: 'Exciting news from Square 15!',
    defaultSubject: '🚀 Exciting News: New Services Now Available!',
    tags: ['announcement', 'new', 'services', 'launch'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="background:linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);display:inline-block;padding:12px 24px;border-radius:50px;margin-bottom:12px;">
        <span style="color:#ffffff;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:2px;">🚀 New Announcement</span>
      </div>
      <h2 style="color:#1e293b;font-size:24px;margin:0 0 8px;">We're Growing, {{customerName}}!</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">
        We're thrilled to announce new services added to our portfolio.
      </p>
    </div>
    <div style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:24px;">
      <h3 style="color:#4f46e5;font-size:16px;margin:0 0 16px;">What's New:</h3>
      <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e2e8f0;">
        <h4 style="color:#1e293b;font-size:15px;margin:0 0 4px;">🏗️ Construction & Renovations</h4>
        <p style="color:#64748b;font-size:13px;margin:0;">Full-scale building and renovation projects</p>
      </div>
      <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e2e8f0;">
        <h4 style="color:#1e293b;font-size:15px;margin:0 0 4px;">🏢 Commercial Maintenance</h4>
        <p style="color:#64748b;font-size:13px;margin:0;">Shopping centers, offices, and commercial properties</p>
      </div>
      <div>
        <h4 style="color:#1e293b;font-size:15px;margin:0 0 4px;">🔋 Solar & Energy Solutions</h4>
        <p style="color:#64748b;font-size:13px;margin:0;">Solar panel installation and energy-efficient upgrades</p>
      </div>
    </div>
    <div style="text-align:center;">
      <a href="https://www.square15.co.za" style="display:inline-block;background:linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Explore Our Services →
      </a>
    </div>
  </div>`, '#6366f1', 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)')
  },

  {
    id: 'announcement-referral',
    name: 'Referral Program',
    description: 'Encourage customer referrals with an incentive-based campaign',
    category: 'announcement',
    thumbnail: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
    previewText: 'Earn rewards by referring friends!',
    defaultSubject: '🤝 Refer a Friend & Both Get Rewarded!',
    tags: ['referral', 'reward', 'share'],
    htmlBody: wrapInEmailLayout(`
  <div style="padding:32px 24px;text-align:center;">
    <div style="font-size:48px;margin-bottom:8px;">🤝</div>
    <h2 style="color:#1e293b;font-size:24px;margin:0 0 8px;">Share the Love, {{customerName}}!</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Know someone who needs property maintenance? Refer them to Square 15 and you'll both benefit!
    </p>
    <div style="background:linear-gradient(135deg, #fff7ed 0%, #fef2f2 100%);border-radius:16px;padding:24px;margin-bottom:24px;">
      <h3 style="color:#ea580c;font-size:18px;margin:0 0 16px;">How It Works</h3>
      <div style="margin-bottom:16px;">
        <div style="background:#f97316;color:white;width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;">1</div>
        <p style="color:#374151;font-size:14px;margin:8px 0 0;">Tell a friend about Square 15</p>
      </div>
      <div style="margin-bottom:16px;">
        <div style="background:#f97316;color:white;width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;">2</div>
        <p style="color:#374151;font-size:14px;margin:8px 0 0;">They mention your name when booking</p>
      </div>
      <div>
        <div style="background:#f97316;color:white;width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;">3</div>
        <p style="color:#374151;font-size:14px;margin:8px 0 0;">You both get <strong>10% off</strong> your next service!</p>
      </div>
    </div>
    <a href="https://www.square15.co.za" style="display:inline-block;background:linear-gradient(135deg, #f97316 0%, #ef4444 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
      Learn More →
    </a>
  </div>`, '#f97316', 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)')
  },
];

/**
 * Get all campaign templates
 */
export function getAllTemplates(): CampaignTemplate[] {
  return campaignTemplates;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: CampaignTemplate['category']): CampaignTemplate[] {
  return campaignTemplates.filter(t => t.category === category);
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(id: string): CampaignTemplate | undefined {
  return campaignTemplates.find(t => t.id === id);
}

/**
 * Get template categories with count
 */
export function getTemplateCategories(): Array<{ category: string; label: string; count: number; icon: string }> {
  const categories: Record<string, { label: string; icon: string }> = {
    all: { label: 'All Templates', icon: '📋' },
    discount: { label: 'Discounts & Offers', icon: '💰' },
    seasonal: { label: 'Seasonal', icon: '🌤️' },
    service: { label: 'Service Spotlight', icon: '🔧' },
    followup: { label: 'Follow-Up', icon: '📩' },
    newsletter: { label: 'Newsletter', icon: '📬' },
    holiday: { label: 'Holiday', icon: '🎄' },
    announcement: { label: 'Announcements', icon: '📢' },
  };

  return Object.entries(categories).map(([key, value]) => ({
    category: key,
    label: value.label,
    icon: value.icon,
    count: key === 'all' ? campaignTemplates.length : campaignTemplates.filter(t => t.category === key).length,
  }));
}
