--
-- PostgreSQL database dump
--

\restrict gEXWN1qLKZzQ2AP7FlvyD0L9uX2PCEFs7nDJE2zDho3ENblocsOBLiZ4BkGeSuJ

-- Dumped from database version 17.7 (Debian 17.7-3.pgdg13+1)
-- Dumped by pg_dump version 18.2 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: listings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listings (
    id integer NOT NULL,
    airbnb_url text NOT NULL,
    name text,
    thumbnail_url text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.listings OWNER TO postgres;

--
-- Name: listings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.listings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.listings_id_seq OWNER TO postgres;

--
-- Name: listings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.listings_id_seq OWNED BY public.listings.id;


--
-- Name: price_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.price_snapshots (
    id integer NOT NULL,
    listing_id integer,
    date_range text NOT NULL,
    total_price integer,
    search_context text NOT NULL,
    checked_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.price_snapshots OWNER TO postgres;

--
-- Name: price_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.price_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.price_snapshots_id_seq OWNER TO postgres;

--
-- Name: price_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.price_snapshots_id_seq OWNED BY public.price_snapshots.id;


--
-- Name: listings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings ALTER COLUMN id SET DEFAULT nextval('public.listings_id_seq'::regclass);


--
-- Name: price_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_snapshots ALTER COLUMN id SET DEFAULT nextval('public.price_snapshots_id_seq'::regclass);


--
-- Data for Name: listings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.listings (id, airbnb_url, name, thumbnail_url, created_at) FROM stdin;
1	https://www.airbnb.com/rooms/1147445288768551866	Chalet in Kings Beach	https://a0.muscache.com/im/pictures/hosting/Hosting-1147445288768551866/original/403766c3-5500-4815-b1bc-650a666690b7.jpeg?im_w=720&amp;width=720&amp;quality=70&amp;auto=webp	2026-03-04 08:14:08.645045
14	https://www.airbnb.com/rooms/1620446257057951340	Cabin in Tahoma	https://a0.muscache.com/im/pictures/hosting/Hosting-1620446257057951340/original/4237ea78-97aa-4a50-84b0-23b7516a354e.png?im_w=720&amp;width=720&amp;quality=70&amp;auto=webp	2026-03-06 02:36:41
22	https://www.airbnb.com/rooms/1431404916133936931	Home in Tahoe City	https://a0.muscache.com/im/pictures/hosting/Hosting-1431404916133936931/original/08778577-2eee-425d-b745-6a1a9548635a.png?im_w=720&amp;width=720&amp;quality=70&amp;auto=webp	2026-03-06 02:34:46
16	https://www.airbnb.com/rooms/816596801721575453	Home in Tahoe City	https://a0.muscache.com/im/pictures/prohost-api/Hosting-816596801721575453/original/0f973715-ef7b-4240-b35e-6d2c1c6ca423.jpeg?im_w=720&amp;width=720&amp;quality=70&amp;auto=webp	2026-03-06 02:33:52
9	https://www.airbnb.com/rooms/600586661738508832	Home in Tahoma	https://a0.muscache.com/im/pictures/miso/Hosting-600586661738508832/original/0982114e-c457-4a73-a7be-4cc23fcf9d11.jpeg?im_w=720&amp;width=720&amp;quality=70&amp;auto=webp	2026-03-06 00:17:48.793341
15	https://www.airbnb.com/rooms/960126963810357467	Cabin in Homewood	https://a0.muscache.com/im/pictures/prohost-api/Hosting-960126963810357467/original/0fe88ea8-1fa8-405f-b30f-1d60d4ec6224.jpeg?im_w=720&amp;width=720&amp;quality=70&amp;auto=webp	2026-03-06 02:35:49.674586
\.


--
-- Data for Name: price_snapshots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.price_snapshots (id, listing_id, date_range, total_price, search_context, checked_at) FROM stdin;
1	1	Apr 24 - Apr 26	730	weekend|march,april	2026-03-04 08:14:08.645045
4	1	Apr 24 - Apr 26	729	weekend|march,april	2026-03-05 06:02:15.131596
9	9	May 1 - May 3	5883	weekend|may	2026-03-06 00:17:48.793341
12	9	Aug 16 - Aug 21	34048	week|august	2026-03-06 00:21:18.980456
15	15	Mar 20 - Mar 22	1896	weekend|march	2026-03-06 02:35:49.674586
16	16	Mar 27 - Mar 29	1441	weekend|march	2026-03-06 02:36:41.999765
19	16	Aug 23 - Aug 28	4693	week|august	2026-03-06 02:42:17.419887
22	22	Aug 9 - Aug 14	5115	week|august	2026-03-06 02:48:46.188365
23	22	Aug 2 - Aug 7	5200	week|august	2026-02-04 01:22:56
24	15	Mar 20 - Mar 22	1890	weekend|march	2026-01-12 05:45:23
25	14	Mar 20 - Mar 22	1050	weekend|march	2026-01-03 03:21:52
26	14	Mar 20 - Mar 22	1027	weekend|march	2026-01-14 01:37:12
27	14	Mar 6 - Mar 8	1005	weekend|march	2026-02-02 07:14:52
28	22	Aug 9 - Aug 14	5195	week|august	2026-02-17 05:18:46
14	14	Mar 20 - Mar 22	1000	weekend|march	2026-03-06 02:36:41
29	15	Mar 27 - Mar 29	1896	weekend|march	2026-03-09 01:15:49
30	14	Mar 16 - Mar 20	1167	4night|march	2026-01-23 01:38:25
31	14	Mar 20 - Mar 24	1170	4night|march	2026-02-18 07:17:32
32	14	Mar 16 - Mar 20	1167	4night|march	2026-01-28 04:38:25
34	22	Sep 25 - Sep 27	1901	weekend|september	2026-02-24 04:52:35
33	22	Sep 25 - Sep 27	1901	weekend|september	2026-02-22 04:52:08
35	16	Aug 23 - Aug 28	4695	week|august	2026-03-08 04:54:42
\.


--
-- Name: listings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.listings_id_seq', 30, true);


--
-- Name: price_snapshots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.price_snapshots_id_seq', 38, true);


--
-- Name: listings listings_airbnb_url_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_airbnb_url_key UNIQUE (airbnb_url);


--
-- Name: listings listings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);


--
-- Name: price_snapshots price_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_snapshots
    ADD CONSTRAINT price_snapshots_pkey PRIMARY KEY (id);


--
-- Name: price_snapshots price_snapshots_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_snapshots
    ADD CONSTRAINT price_snapshots_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict gEXWN1qLKZzQ2AP7FlvyD0L9uX2PCEFs7nDJE2zDho3ENblocsOBLiZ4BkGeSuJ

