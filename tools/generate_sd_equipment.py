"""Original category-shaped rigid GLBs, with grip at origin. No user data writes."""
import math
from generate_sd_base import Model, ROOT


def box(m, part, material, center, size):
    for axis in range(3):
        for sign in (-1, 1):
            normal = [0,0,0]
            normal[axis] = sign
            u,v = (axis+1)%3,(axis+2)%3
            ids = []
            for a,b in ((-1,-1),(1,-1),(1,1),(-1,1)):
                p = list(center)
                p[axis] += sign*size[axis]/2
                p[u] += a*size[u]/2
                p[v] += b*size[v]/2
                ids.append(m.vertex((part,material),p,normal,[('Grip',1)]))
            if sign < 0:
                ids.reverse()
            m.parts[(part,material)]['i'].extend([ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]])


def build(key):
    m = Model()
    m.bone('Grip',(0,0,0))
    metal=m.material('Steel',(.34,.43,.52),.32,.7)
    gold=m.material('Brass',(.62,.32,.06),.4,.65)
    wood=m.material('Wood',(.14,.053,.018),.87)
    teal=m.material('Teal',(.045,.25,.22),.7)
    white=m.material('Ivory',(.87,.79,.6),.85)
    gem=m.material('Gem',(.025,.40,.7),.22,.2)
    def sphere(name,mat,p,r,**kw): m.ellipsoid((name,mat),'Grip',p,r,**kw)
    def block(name,mat,p,r): box(m,name,mat,p,r)
    if key in ('oneHandSword','twoHandSword'):
        length=.77 if key=='oneHandSword' else 1.15
        sphere('Blade',metal,(0,.19+length/2,0),(.065 if key=='oneHandSword' else .095,length/2,.022),segments=8,rings=8)
        block('BladeCore',metal,(0,.27,0),(.10,.16,.038))
        block('Guard',gold,(0,.16,0),(.30,.055,.065))
        block('Grip',wood,(0,-.015,0),(.065,.28,.065))
        sphere('Pommel',gold,(0,-.18,0),(.05,.05,.05))
    elif key in ('oneHandMace','twoHandMace'):
        length=.55 if key=='oneHandMace' else .85
        block('Shaft',wood,(0,length/2-.15,0),(.06,length,.06))
        sphere('Head',metal,(0,length-.1,0),(.16,.20,.16))
        for x in (-1,1): block('Flange',gold,(x*.16,length-.1,0),(.035,.24,.20))
    elif key=='staff':
        block('Shaft',wood,(0,.12,0),(.055,1.5,.055))
        sphere('Crown',gold,(0,.88,0),(.12,.14,.09))
        sphere('Crystal',gem,(0,1.04,0),(.095,.17,.075),segments=6,rings=4)
        block('GripWrap',teal,(0,0,0),(.065,.18,.065))
    elif key=='bow':
        for i in range(18):
            t=(i+.5)/18
            y=-.65+t*1.3
            x=.22*math.sin(math.pi*t)
            tilt=-math.degrees(math.atan(.22*math.pi/1.3*math.cos(math.pi*t)))
            sphere('BowLimb',wood,(x,y,0),(.035,.065,.032),tilt=tilt,segments=8,rings=6)
        block('String',white,(0,0,0),(.008,1.3,.008))
        block('GripWrap',teal,(.22,0,0),(.07,.18,.07))
        # Origin is the actual grip, not the center of the bowstring.
        for data in m.parts.values(): data['p']=[(x-.22,y,z) for x,y,z in data['p']]
    elif key=='gun':
        block('Barrel',metal,(0,.09,.17),(.10,.11,.45))
        block('Handle',wood,(0,-.045,-.015),(.085,.22,.085))
        block('Sight',gold,(0,.163,.31),(.025,.045,.035))
    elif key=='shield':
        sphere('Rim',gold,(0,.06,.05),(.32,.41,.055),segments=16,rings=12)
        sphere('Face',teal,(0,.06,.078),(.285,.365,.055),segments=16,rings=12)
        sphere('Boss',metal,(0,.06,.14),(.085,.085,.045))
    elif key=='healingBook':
        block('Pages',white,(0,.15,.01),(.25,.33,.064))
        for z in (-.037,.057): block('Cover',teal,(0,.15,z),(.28,.36,.018))
        block('Spine',gold,(-.135,.15,.01),(.025,.36,.11))
        block('Cross',gold,(0,.15,.071),(.13,.035,.008))
        block('Cross',gold,(0,.15,.072),(.035,.17,.008))
    elif key.startswith('armor_'):
        kind=key.removeprefix('armor_')
        palette={'plate':((.32,.42,.52),.4,.75),'chain':((.20,.25,.30),.63,.65),
                 'leather':((.23,.10,.035),.9,0),'cloth':((.065,.24,.21),1,0)}
        color,roughness,metallic=palette[kind]
        armor=m.material(kind,color,roughness,metallic)
        sphere('TorsoShell',armor,(0,-.07,0),(.305,.288,.23),segments=16,rings=12)
        if kind=='plate':
            block('BreastplateRidge',gold,(0,-.035,.228),(.035,.25,.022))
        elif kind=='chain':
            for row in range(7):
                for col in range(7):
                    x=(col-3)*.06;y=-.22+row*.045
                    z=.23*math.sqrt(max(.01,1-(x/.305)**2-((y+.07)/.288)**2))
                    sphere('Links',metal,(x,y,z),(.024,.018,.008),segments=8,rings=4)
        elif kind=='leather':
            block('Buckle',gold,(0,-.13,.235),(.07,.05,.018))
        else:
            sphere('Brooch',gold,(0,.11,.19),(.032,.036,.016))
    path=ROOT/'assets/characters/equipment'/f'{key}.glb'
    m.write(path,skinned=False,metadata={'categoryPreview':key,'authoringSource':'tools/generate_sd_equipment.py','gripOrigin':[0,0,0]})


if __name__=='__main__':
    for key in ('oneHandSword','twoHandSword','oneHandMace','twoHandMace','staff','bow','gun','shield','healingBook',
                'armor_plate','armor_chain','armor_leather','armor_cloth'):
        build(key)
