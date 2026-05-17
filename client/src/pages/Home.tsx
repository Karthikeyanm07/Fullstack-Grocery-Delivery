import AppPromoBanner from "../components/home/AppPromoBanner.tsx";
import Features from "../components/home/Features.tsx";
import Hero from "../components/home/Hero.tsx";
import HomeCategories from "../components/home/HomeCategories.tsx";
import NewsLetter from "../components/home/NewsLetter.tsx";
import PopularProducts from "../components/home/PopularProducts.tsx";

const Home = () => {
	return (
		<div className="min-h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
			<Hero />
			<Features />
			<HomeCategories />
			<PopularProducts />
			<AppPromoBanner />
			<NewsLetter />
		</div>
	);
};

export default Home;
