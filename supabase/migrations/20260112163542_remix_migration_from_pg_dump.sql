CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: pix_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pix_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id text NOT NULL,
    plan_name text NOT NULL,
    value integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pix_payments pix_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pix_payments
    ADD CONSTRAINT pix_payments_pkey PRIMARY KEY (id);


--
-- Name: pix_payments pix_payments_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pix_payments
    ADD CONSTRAINT pix_payments_transaction_id_key UNIQUE (transaction_id);


--
-- Name: idx_pix_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pix_payments_status ON public.pix_payments USING btree (status);


--
-- Name: idx_pix_payments_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pix_payments_transaction_id ON public.pix_payments USING btree (transaction_id);


--
-- Name: pix_payments update_pix_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pix_payments_updated_at BEFORE UPDATE ON public.pix_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pix_payments Allow service role to manage pix_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow service role to manage pix_payments" ON public.pix_payments USING (true) WITH CHECK (true);


--
-- Name: pix_payments Deny anonymous read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny anonymous read access" ON public.pix_payments FOR SELECT TO anon USING (false);


--
-- Name: pix_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;