import React, { useState } from 'react';
import { ArrowRight, Sparkles, ShieldCheck, Truck, RefreshCw, Star, Heart, Mail } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { HeroBanner } from './HeroBanner.tsx';
import { CategoryScroller } from './CategoryScroller.tsx';
import { ProductCard } from './ProductCard.tsx';
import appLogo from '../assets/images/AppLogo.jpeg';

export const HomeView: React.FC = () => {
  const { products, setActiveTab, setSelectedCategory, settings, isLoading } = useStore();
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSender, setEmailSender] = useState('');

  const activeProducts = products.filter(p => p.isActive);
  const featured = activeProducts.filter(p => p.isFeatured);
  const displayFeatured = (featured.length > 0 ? featured : activeProducts).slice(0, 4);

  const bestSellers = activeProducts.filter(p => p.isBestSeller);
  const displayBestSellers = (bestSellers.length > 0 ? bestSellers : activeProducts.slice(4)).slice(0, 4);

  const newArrivals = activeProducts.filter(p => p.isNewArrival);
  const displayNewArrivals = (newArrivals.length > 0 ? newArrivals : activeProducts.slice(8)).slice(0, 4);

  const renderSkeletons = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
      {[1, 2, 3, 4].map(n => (
        <div key={n} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse space-y-3">
          <div className="aspect-square bg-slate-100 rounded-xl w-full" />
          <div className="h-4 bg-slate-100 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="pb-24 space-y-8">
      {/* Dynamic Hero Promotional Banner */}
      <HeroBanner />

      {/* Categories Horizontal Carousel */}
      <CategoryScroller />

      {/* Featured Curations Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Featured Curations
            </h2>
            <p className="text-xs text-slate-500">
              Handcrafted brushes, detanglers & premium vanity caddies
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setActiveTab('shop');
            }}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>See All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading && products.length === 0 ? (
          renderSkeletons()
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {displayFeatured.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Value Proposition Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-6 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-white mb-0.5">Fast Delivery & COD</h3>
              <p className="text-xs text-slate-300">
                Delivery local and TCS also. Cash on delivery available at your doorstep across Pakistan.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-white mb-0.5">7-Day Easy Returns</h3>
              <p className="text-xs text-slate-300">
                Hassle-free replacement guarantee on personal beauty & storage accessories.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-white mb-0.5">100% Quality Checked</h3>
              <p className="text-xs text-slate-300">
                Every bristle, grip, and organizer acrylic drawer is rigorously inspected before dispatch.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Best Sellers Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Best Sellers
            </h2>
            <p className="text-xs text-slate-500">
              Most loved by our community across Pakistan
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setActiveTab('shop');
            }}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors"
          >
            <span>See All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading && products.length === 0 ? (
          renderSkeletons()
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {displayBestSellers.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* New Arrivals Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              New Arrivals
            </h2>
            <p className="text-xs text-slate-500">
              Fresh additions to elevate your everyday routines
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setActiveTab('shop');
            }}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>See All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading && products.length === 0 ? (
          renderSkeletons()
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {displayNewArrivals.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Complete All Products Collection from Firestore */}
      <section id="collection" className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>All Products & Collection</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                {activeProducts.length} items
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Complete catalog loaded directly from Firestore with verified details and Cloudinary photos
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setActiveTab('shop');
            }}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Filter Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading && products.length === 0 ? (
          renderSkeletons()
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {activeProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Store Footer */}
      <footer className="border-t border-slate-200/80 bg-white pt-10 pb-16 px-4 sm:px-6 mt-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <img
                src={appLogo}
                alt={settings?.storeName || 'Zamzam'}
                className="w-8 h-8 rounded-lg object-cover shadow-xs border border-amber-200/60"
              />
              <span className="font-heading text-lg font-bold text-slate-900">
                {settings?.storeName || 'Zamzam'}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {settings?.aboutText || 'Zamzam curates salon-grade hair care brushes, high-precision personal grooming tools, and elegant cosmetic storage designed for modern everyday living.'}
            </p>
            <p className="text-xs text-slate-600 font-medium">
              Lahore, Pakistan · Nationwide Delivery
            </p>
          </div>

          <div>
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Shop Collections
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <button onClick={() => { setSelectedCategory('cat-hair'); setActiveTab('shop'); }} className="hover:text-slate-900">
                  Hairbrushes & Thermal Rollers
                </button>
              </li>
              <li>
                <button onClick={() => { setSelectedCategory('cat-organizers'); setActiveTab('shop'); }} className="hover:text-slate-900">
                  Cosmetic Vanity Organizers
                </button>
              </li>
              <li>
                <button onClick={() => { setSelectedCategory('cat-beauty'); setActiveTab('shop'); }} className="hover:text-slate-900">
                  French Hair Claw Clips
                </button>
              </li>
              <li>
                <button onClick={() => { setSelectedCategory('cat-household'); setActiveTab('shop'); }} className="hover:text-slate-900">
                  Household Storage Solutions
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Customer Services
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <button onClick={() => setActiveTab('track')} className="hover:text-slate-900">
                  Guest Order Tracking
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('wishlist')} className="hover:text-slate-900">
                  My Wishlist
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('track')} className="hover:text-slate-900">
                  Shipping & Return Policy
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('shop')} className="hover:text-slate-900">
                  All Collections
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Direct Inquiries
            </h4>
            <div className="space-y-2 text-xs text-slate-600">
              <p>WhatsApp / Call: <strong className="text-slate-900">{settings?.contactPhone || '03049002888'}</strong></p>
              
              <div className="pt-1 space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-700">Send Inquiry via Email</p>
                <input
                  type="text"
                  value={emailSender}
                  onChange={(e) => setEmailSender(e.target.value)}
                  placeholder="Your name or phone"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={2}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                />
                <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=yk5550950@gmail.com&su=${encodeURIComponent('Inquiry for Zamzam Store')}&body=${encodeURIComponent(
                    (emailSender ? `From: ${emailSender}\n\n` : '') +
                    (emailMessage.trim() ? emailMessage.trim() : 'Hello, I have an inquiry regarding your products.')
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send via Gmail</span>
                </a>
              </div>

              <p className="pt-1 text-[11px] text-slate-400">Cash on Delivery Available Nationwide</p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-slate-100 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400">
          <p>© {new Date().getFullYear()} {settings?.storeName || 'Zamzam'}. All rights reserved.</p>
          <div className="flex items-center gap-4 mt-2 sm:mt-0">
            <span>Secure Guest Checkout</span>
            <span>·</span>
            <span>Zero Account Required</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
