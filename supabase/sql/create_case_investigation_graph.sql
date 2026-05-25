create or replace function public.create_case_investigation_graph(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action_id uuid;
  action_ids_by_temp_id jsonb := '{}'::jsonb;
  action_payload jsonb;
  action_record public.investigation_actions%rowtype;
  created_action public.investigation_actions%rowtype;
  created_action_prerequisite public.action_prerequisites%rowtype;
  created_contradiction_unlock_rule public.contradiction_unlock_rules%rowtype;
  created_evidence_unlock_rule public.evidence_unlock_rules%rowtype;
  created_statement_unlock_rule public.statement_unlock_rules%rowtype;
  action_prerequisite_record public.action_prerequisites%rowtype;
  contradiction_unlock_rule_record public.contradiction_unlock_rules%rowtype;
  evidence_unlock_rule_record public.evidence_unlock_rules%rowtype;
  created_action_prerequisites jsonb := '[]'::jsonb;
  created_actions jsonb := '[]'::jsonb;
  created_contradiction_unlock_rules jsonb := '[]'::jsonb;
  created_evidence_unlock_rules jsonb := '[]'::jsonb;
  created_statement_unlock_rules jsonb := '[]'::jsonb;
  prerequisite_action_id uuid;
  prerequisite_payload jsonb;
  prerequisite_temp_id text;
  rule_payload jsonb;
  statement_unlock_rule_record public.statement_unlock_rules%rowtype;
begin
  for action_payload in
    select value from jsonb_array_elements(coalesce(payload -> 'actions', '[]'::jsonb))
  loop
    action_record := jsonb_populate_record(
      null::public.investigation_actions,
      jsonb_build_object(
        'case_id', payload ->> 'caseId',
        'title', action_payload ->> 'title',
        'description', action_payload ->> 'description',
        'action_type', action_payload ->> 'actionType',
        'required_skill', nullif(action_payload ->> 'requiredSkill', ''),
        'minimum_skill_level', action_payload ->> 'minimumSkillLevel',
        'base_duration_minutes', action_payload ->> 'baseDurationMinutes',
        'is_initially_available', action_payload ->> 'isInitiallyAvailable',
        'requires_detective', action_payload ->> 'requiresDetective',
        'metadata', coalesce(action_payload -> 'metadata', '{}'::jsonb)
      )
    );

    insert into public.investigation_actions (
      case_id,
      title,
      description,
      action_type,
      required_skill,
      minimum_skill_level,
      base_duration_minutes,
      is_initially_available,
      requires_detective,
      metadata
    )
    values (
      action_record.case_id,
      action_record.title,
      action_record.description,
      action_record.action_type,
      action_record.required_skill,
      action_record.minimum_skill_level,
      action_record.base_duration_minutes,
      action_record.is_initially_available,
      action_record.requires_detective,
      action_record.metadata
    )
    returning * into created_action;

    action_ids_by_temp_id := action_ids_by_temp_id ||
      jsonb_build_object(action_payload ->> 'tempId', created_action.id::text);
    created_actions := created_actions || jsonb_build_array(to_jsonb(created_action));
  end loop;

  for rule_payload in
    select value from jsonb_array_elements(coalesce(payload -> 'evidenceUnlockRules', '[]'::jsonb))
  loop
    action_id := (action_ids_by_temp_id ->> (rule_payload ->> 'actionTempId'))::uuid;

    if action_id is null then
      raise exception 'Unknown generated action tempId: %', rule_payload ->> 'actionTempId';
    end if;

    evidence_unlock_rule_record := jsonb_populate_record(
      null::public.evidence_unlock_rules,
      jsonb_build_object(
        'action_id', action_id,
        'evidence_id', rule_payload ->> 'evidenceId',
        'required_skill', nullif(rule_payload ->> 'requiredSkill', ''),
        'minimum_skill_level', rule_payload ->> 'minimumSkillLevel',
        'duration_modifier_minutes', rule_payload ->> 'durationModifierMinutes',
        'is_guaranteed', rule_payload ->> 'isGuaranteed',
        'success_chance', rule_payload ->> 'successChance'
      )
    );

    insert into public.evidence_unlock_rules (
      action_id,
      evidence_id,
      required_skill,
      minimum_skill_level,
      duration_modifier_minutes,
      is_guaranteed,
      success_chance
    )
    values (
      evidence_unlock_rule_record.action_id,
      evidence_unlock_rule_record.evidence_id,
      evidence_unlock_rule_record.required_skill,
      evidence_unlock_rule_record.minimum_skill_level,
      evidence_unlock_rule_record.duration_modifier_minutes,
      evidence_unlock_rule_record.is_guaranteed,
      evidence_unlock_rule_record.success_chance
    )
    returning * into created_evidence_unlock_rule;

    created_evidence_unlock_rules := created_evidence_unlock_rules ||
      jsonb_build_array(to_jsonb(created_evidence_unlock_rule));
  end loop;

  for rule_payload in
    select value from jsonb_array_elements(coalesce(payload -> 'statementUnlockRules', '[]'::jsonb))
  loop
    action_id := (action_ids_by_temp_id ->> (rule_payload ->> 'actionTempId'))::uuid;

    if action_id is null then
      raise exception 'Unknown generated action tempId: %', rule_payload ->> 'actionTempId';
    end if;

    statement_unlock_rule_record := jsonb_populate_record(
      null::public.statement_unlock_rules,
      jsonb_build_object(
        'action_id', action_id,
        'statement_id', rule_payload ->> 'statementId',
        'required_skill', nullif(rule_payload ->> 'requiredSkill', ''),
        'minimum_skill_level', rule_payload ->> 'minimumSkillLevel',
        'is_guaranteed', rule_payload ->> 'isGuaranteed',
        'success_chance', rule_payload ->> 'successChance'
      )
    );

    insert into public.statement_unlock_rules (
      action_id,
      statement_id,
      required_skill,
      minimum_skill_level,
      is_guaranteed,
      success_chance
    )
    values (
      statement_unlock_rule_record.action_id,
      statement_unlock_rule_record.statement_id,
      statement_unlock_rule_record.required_skill,
      statement_unlock_rule_record.minimum_skill_level,
      statement_unlock_rule_record.is_guaranteed,
      statement_unlock_rule_record.success_chance
    )
    returning * into created_statement_unlock_rule;

    created_statement_unlock_rules := created_statement_unlock_rules ||
      jsonb_build_array(to_jsonb(created_statement_unlock_rule));
  end loop;

  for rule_payload in
    select value from jsonb_array_elements(coalesce(payload -> 'contradictionUnlockRules', '[]'::jsonb))
  loop
    action_id := (action_ids_by_temp_id ->> (rule_payload ->> 'actionTempId'))::uuid;

    if action_id is null then
      raise exception 'Unknown generated action tempId: %', rule_payload ->> 'actionTempId';
    end if;

    contradiction_unlock_rule_record := jsonb_populate_record(
      null::public.contradiction_unlock_rules,
      jsonb_build_object(
        'action_id', action_id,
        'contradiction_id', rule_payload ->> 'contradictionId',
        'required_skill', nullif(rule_payload ->> 'requiredSkill', ''),
        'minimum_skill_level', rule_payload ->> 'minimumSkillLevel',
        'is_guaranteed', rule_payload ->> 'isGuaranteed',
        'success_chance', rule_payload ->> 'successChance'
      )
    );

    insert into public.contradiction_unlock_rules (
      action_id,
      contradiction_id,
      required_skill,
      minimum_skill_level,
      is_guaranteed,
      success_chance
    )
    values (
      contradiction_unlock_rule_record.action_id,
      contradiction_unlock_rule_record.contradiction_id,
      contradiction_unlock_rule_record.required_skill,
      contradiction_unlock_rule_record.minimum_skill_level,
      contradiction_unlock_rule_record.is_guaranteed,
      contradiction_unlock_rule_record.success_chance
    )
    returning * into created_contradiction_unlock_rule;

    created_contradiction_unlock_rules := created_contradiction_unlock_rules ||
      jsonb_build_array(to_jsonb(created_contradiction_unlock_rule));
  end loop;

  for prerequisite_payload in
    select value from jsonb_array_elements(coalesce(payload -> 'actionPrerequisites', '[]'::jsonb))
  loop
    action_id := (action_ids_by_temp_id ->> (prerequisite_payload ->> 'actionTempId'))::uuid;
    prerequisite_temp_id := prerequisite_payload ->> 'prerequisiteActionTempId';

    if action_id is null then
      raise exception 'Unknown generated action tempId: %', prerequisite_payload ->> 'actionTempId';
    end if;

    prerequisite_action_id := null;
    if prerequisite_temp_id is not null then
      prerequisite_action_id := (action_ids_by_temp_id ->> prerequisite_temp_id)::uuid;

      if prerequisite_action_id is null then
        raise exception 'Unknown generated prerequisite action tempId: %', prerequisite_temp_id;
      end if;
    end if;

    action_prerequisite_record := jsonb_populate_record(
      null::public.action_prerequisites,
      jsonb_build_object(
        'action_id', action_id,
        'prerequisite_action_id', prerequisite_action_id,
        'prerequisite_evidence_id', prerequisite_payload ->> 'prerequisiteEvidenceId',
        'prerequisite_contradiction_id', prerequisite_payload ->> 'prerequisiteContradictionId'
      )
    );

    insert into public.action_prerequisites (
      action_id,
      prerequisite_action_id,
      prerequisite_evidence_id,
      prerequisite_contradiction_id
    )
    values (
      action_prerequisite_record.action_id,
      action_prerequisite_record.prerequisite_action_id,
      action_prerequisite_record.prerequisite_evidence_id,
      action_prerequisite_record.prerequisite_contradiction_id
    )
    returning * into created_action_prerequisite;

    created_action_prerequisites := created_action_prerequisites ||
      jsonb_build_array(to_jsonb(created_action_prerequisite));
  end loop;

  return jsonb_build_object(
    'actionPrerequisites', created_action_prerequisites,
    'actions', created_actions,
    'contradictionUnlockRules', created_contradiction_unlock_rules,
    'evidenceUnlockRules', created_evidence_unlock_rules,
    'statementUnlockRules', created_statement_unlock_rules
  );
end;
$$;

revoke all on function public.create_case_investigation_graph(jsonb) from public;
grant execute on function public.create_case_investigation_graph(jsonb) to service_role;
notify pgrst, 'reload schema';
