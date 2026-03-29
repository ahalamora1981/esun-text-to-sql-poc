from langchain.agents.middleware import dynamic_prompt, ModelRequest

from ..db import get_all_ddl, get_all_sample_rows
from ..prompts import BASE_SYSTEM_PROMPT


@dynamic_prompt
def inject_schema(request: ModelRequest) -> str:
    ddl = get_all_ddl()
    samples = get_all_sample_rows()
    system_prompt = BASE_SYSTEM_PROMPT.format(schema=ddl, samples=samples)
    # print(f"### system_prompt ###\n{system_prompt}")
    return system_prompt
