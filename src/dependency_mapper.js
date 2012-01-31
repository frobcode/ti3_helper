
function create_tech_tree(tech_tree_desc)
{
    var bigIndex = Object();
    for(var counter in tech_tree_desc)
    {
        // first, let's build the big list
        var tech = tech_tree_desc[counter];
        var shortName = tech.sn;
        tech.makes_available=[]; // the set of techs that this tech helps allow
        tech.have = false;
        tech.tree = bigIndex;
        bigIndex[shortName]=tech;
        // done!  easy.
    }
    // now build the set of techs made available by any particular tech
    // the way the prereq list works is that it is an array of arrays.
    // each inner array is a set of 'or'd values.  Each inner array is anded with the others.
    // so War Suns, which need deep space cannon AND sarween tools == [[dsc],[st]]
    for(var techname in bigIndex)
    {
        var we_depend_on = bigIndex[techname];
        prereqs = we_depend_on.pr;
        var resolved_prereqs = [];
        for(var anded_conditions in prereqs)
        {
            var resolved_ord_set = [];
            ord_condition_set = prereqs[anded_conditions];
            for( var ord_condition_counter in ord_condition_set)
            {
                target_techname = ord_condition_set[ord_condition_counter];
                target_tech = bigIndex[target_techname];
                target_tech.makes_available.push(techname);
                resolved_ord_set.push( target_tech );
            }
            resolved_prereqs.push(resolved_ord_set);
        }
        we_depend_on.prerequisites=resolved_prereqs;
    }

    return bigIndex;
}

function techs_we_have(bigIndex)
{
    var techs = [];
    for( var counter in bigIndex)
    {
        if(bigIndex[counter].have) {
            techs.push(bigIndex[counter]);
        }
    }
    return techs;
}

function is_tech_available(tech)
{
    // this will tell us if a tech is available.
    var prereqs = tech.prerequisites;
    var in_and_set = false;
    for( var anded_set_counter in prereqs)
    {
        var or_set = prereqs[prereq_set_counter];
        var in_or_set = false;
        for( var or_set_counter in or_set)
        {
            if( or_set[or_set_counter].have )
            {
                in_or_set = true;
                break;
            }
        }
        // if there was one missing from the set, then...
        if(! in_or_set )
        {
            return false;
        }
    }
}

