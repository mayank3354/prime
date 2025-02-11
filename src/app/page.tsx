import Link from 'next/link';
import { ArrowRight, Search, Save, Brain, Lock, Sparkles, Clock, CheckCircle } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Navigation */}
      <nav className="fixed w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 border-b dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-500">Prime</span>
            </div>
            <Link 
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Sign In to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              AI-Powered Research Assistant
              <span className="block text-blue-600 dark:text-blue-500">for Smarter Insights</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-gray-600 dark:text-gray-300">
              Transform your research process with Prime. Get comprehensive insights, analyze data, and generate reports with advanced AI technology.
            </p>
            <div className="mt-10">
              <Link
                href="/dashboard"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
              Powerful Features
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-600 dark:text-gray-300">
              Everything you need to accelerate your research process
            </p>
          </div>

          <div className="mt-20">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1 */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-200"></div>
                <div className="relative p-6 bg-white dark:bg-gray-900 rounded-lg">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <Search className="w-6 h-6 text-blue-600 dark:text-blue-500" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                    Intelligent Research
                  </h3>
                  <p className="mt-2 text-gray-600 dark:text-gray-300">
                    Advanced AI algorithms analyze multiple sources to provide comprehensive research insights.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-200"></div>
                <div className="relative p-6 bg-white dark:bg-gray-900 rounded-lg">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-blue-600 dark:text-blue-500" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                    Smart Analysis
                  </h3>
                  <p className="mt-2 text-gray-600 dark:text-gray-300">
                    Get detailed analysis with credibility scores and relevance ratings for each finding.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-200"></div>
                <div className="relative p-6 bg-white dark:bg-gray-900 rounded-lg">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <Save className="w-6 h-6 text-blue-600 dark:text-blue-500" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                    Save & Organize
                  </h3>
                  <p className="mt-2 text-gray-600 dark:text-gray-300">
                    Save your research findings and organize them for easy access and reference.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
              Why Choose Prime?
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-300 lg:mx-auto">
              Experience the future of research with our cutting-edge AI technology
            </p>
          </div>

          <div className="mt-16">
            <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              {[
                {
                  name: 'Advanced AI Technology',
                  description: 'Powered by state-of-the-art language models for accurate and relevant results.',
                  icon: Sparkles,
                },
                {
                  name: 'Secure & Private',
                  description: 'Your research data is encrypted and protected with enterprise-grade security.',
                  icon: Lock,
                },
                {
                  name: 'Time-Saving',
                  description: 'Reduce research time by up to 80% with automated analysis and summarization.',
                  icon: Clock,
                },
                {
                  name: 'Comprehensive Results',
                  description: 'Get detailed insights with source verification and credibility assessment.',
                  icon: CheckCircle,
                },
              ].map((benefit) => (
                <div key={benefit.name} className="relative">
                  <dt>
                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-600 dark:bg-blue-500 text-white">
                      <benefit.icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900 dark:text-white">
                      {benefit.name}
                    </p>
                  </dt>
                  <dd className="mt-2 ml-16 text-base text-gray-600 dark:text-gray-300">
                    {benefit.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t dark:border-gray-800">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-base text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} Prime. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
