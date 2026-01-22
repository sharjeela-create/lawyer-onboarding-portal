import { supabase } from "@/integrations/supabase/client";

const titleCase = (s: string) => {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const formatAgentLabelFromEmail = (email: string) => {
  const localPart = (email || "").split("@")[0] || "";
  if (!localPart) return "";

  const cleaned = localPart.replace(/[_-]+/g, ".");

  if (cleaned.includes(".")) {
    const [firstRaw, secondRaw] = cleaned.split(".");
    const first = titleCase(firstRaw || "");
    const secondInitial = (secondRaw || "").trim().charAt(0);
    const second = secondInitial ? titleCase(secondInitial) : "";
    return `${first}${second ? " " + second : ""}`.trim();
  }

  return titleCase(cleaned);
};

const getBestDisplayName = (row: { name?: string | null; display_name?: string | null; email?: string | null; fallback?: string }) => {
  const direct = (row.name || row.display_name || "").trim();
  if (direct) return direct;

  const email = (row.email || "").trim();
  if (email) {
    const formatted = formatAgentLabelFromEmail(email);
    return formatted || email;
  }

  return row.fallback || "";
};

const safeSelectAppUsers = async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const full = await supabase
    .from('app_users' as any)
    .select('user_id, name, display_name, email' as any);

  if (!full.error) return full;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const minimal = await supabase
    .from('app_users' as any)
    .select('user_id, display_name, email' as any);

  return minimal;
};

export const fetchAgentDropdownOptions = async (): Promise<Array<{ key: string; label: string }>> => {
  const [agentsRes, appUsersRes] = await Promise.all([
    supabase.from('agents').select('id, name, email'),
    safeSelectAppUsers(),
  ]);

  const out = new Map<string, { key: string; label: string }>();

  if (!agentsRes.error) {
    (agentsRes.data || []).forEach((a) => {
      const label = getBestDisplayName({ name: a.name, email: a.email, fallback: a.id });
      if (!label) return;
      out.set(label.toLowerCase(), { key: `agents:${a.id}`, label });
    });
  }

  if (!appUsersRes.error) {
    (appUsersRes.data || []).forEach((u: any) => {
      const label = getBestDisplayName({ name: u.name, display_name: u.display_name, email: u.email, fallback: u.user_id });
      if (!label) return;
      out.set(label.toLowerCase(), { key: `app_users:${u.user_id || label}`, label });
    });
  }

  return Array.from(out.values()).sort((a, b) => a.label.localeCompare(b.label));
};

export const fetchLicensedCloserOptions = async (): Promise<Array<{ key: string; label: string }>> => {
  const { data: statusRows, error: statusError } = await supabase
    .from('agent_status')
    .select('user_id')
    .eq('agent_type', 'licensed');

  if (statusError || !statusRows?.length) {
    return [];
  }

  const ids = statusRows.map((row: any) => row.user_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = await supabase
    .from('app_users' as any)
    .select('user_id, display_name, email' as any)
    .in('user_id', ids);

  const profileMap = new Map<string, { display_name: string | null; email: string | null }>();
  (profiles || []).forEach((u: any) => {
    profileMap.set(u.user_id, { display_name: u.display_name, email: u.email });
  });

  const out: Array<{ key: string; label: string }> = [];

  ids.forEach((id) => {
    const p = profileMap.get(id);
    const label = p
      ? getBestDisplayName({ display_name: p.display_name, email: p.email, fallback: id })
      : id;
    if (!label) return;
    out.push({ key: id, label });
  });

  return out.sort((a, b) => a.label.localeCompare(b.label));
};
