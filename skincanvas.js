const MAX_BONES = 20;

/**
 * 
 * @param {DOM Element} glcanvas Handle to HTML where the glcanvas resides
 * @param {string} shadersrelpath Path to the folder that contains the shaders,
 *                                relative to where the constructor is being called
 */
class SkinCanvas extends BaseCanvas {

    /**
     * @param {DOM Element} glcanvas Handle to HTML where the glcanvas resides
     * @param {string} shadersrelpath Path to the folder that contains the shaders,
     *                                relative to where the constructor is being called
     * @param {antialias} boolean Whether antialiasing is enabled (true by default)
     */
    constructor(glcanvas, shadersrelpath, antialias) {
        super(glcanvas, shadersrelpath, antialias);
        this.mesh = new SkinMesh(this, this.gl);
        this.camera = new MousePolarCamera(glcanvas.width, glcanvas.height);
        
        this.gui = new dat.GUI();
        const gui = this.gui;
        // Mesh display options menu
        this.drawEdges = false;
        this.drawNormals = false;
        this.drawVertices = false;
        let meshOpts = gui.addFolder('Mesh Display Options');
        let canvas = this;
        ['drawEdges', 'drawNormals', 'drawPoints'].forEach(
            function(s) {
                let evt = meshOpts.add(canvas, s);
                function resolveCheckboxes() {
                    // Make sure canvas normalShader and pointShader have been compiled
                    // before drawing edges/normals/points
                    let ready = true;
                    if (!('shaderReady' in canvas.shaders.normalShader)) {
                        ready = false;
                        canvas.shaders.normalShader.then(resolveCheckboxes);
                    }
                    if (!('shaderReady' in canvas.shaders.pointShader)) {
                        ready = false;
                        canvas.shaders.pointShader.then(resolveCheckboxes);
                    }
                    if (ready) {
                        requestAnimFrame(canvas.repaint.bind(canvas));
                    }
                }
                evt.onChange(resolveCheckboxes);
            }
        );
    
        let simpleRepaint = function() {
            requestAnimFrame(canvas.repaint.bind(canvas));
        }
        gui.add(this.mesh, 'consistentlyOrientFaces').onChange(simpleRepaint);
        gui.add(this.mesh, 'reverseOrientation').onChange(simpleRepaint);
        gui.add(this.mesh, 'randomlyFlipFaceOrientations').onChange(simpleRepaint);
        gui.add(this.mesh, 'saveOffFile').onChange(simpleRepaint);

        this.setupShader();
    
        requestAnimationFrame(this.repaint.bind(this));
    }

    setupShader() {
        const gl = this.gl;
        const that = this;
        this.shaders.skinShader = new Promise((resolve, reject) => {
            getShaderProgramAsync(gl, "skin").then((shader) => {
                shader.description = 'Skinning shader: blinn-phong + transformations';
                shader.vPosAttrib = gl.getAttribLocation(shader, "vPos");
                gl.enableVertexAttribArray(shader.vPosAttrib);
                shader.vNormalAttrib = gl.getAttribLocation(shader, "vNormal");
                gl.enableVertexAttribArray(shader.vNormalAttrib);
                shader.vColorAttrib = gl.getAttribLocation(shader, "vColor");
                gl.enableVertexAttribArray(shader.vColorAttrib);
                shader.vBoneIdxAttrib = gl.getAttribLocation(shader, "vBoneIdx");
                gl.enableVertexAttribArray(shader.vBoneIdxAttrib);
                shader.pMatrixUniform = gl.getUniformLocation(shader, "uPMatrix");
                shader.mvMatrixUniform = gl.getUniformLocation(shader, "uMVMatrix");
                shader.tMatrixUniform = gl.getUniformLocation(shader, "tMatrix");
                shader.nMatrixUniform = gl.getUniformLocation(shader, "uNMatrix");
                shader.ambientColorUniform = gl.getUniformLocation(shader, "uAmbientColor");
                shader.uKaUniform = gl.getUniformLocation(shader, "uKa");
                shader.uKdUniform = gl.getUniformLocation(shader, "uKd");
                shader.uKsUniform = gl.getUniformLocation(shader, "uKs");
                shader.uShininessUniform = gl.getUniformLocation(shader, "uShininess");
                shader.uEyeUniform = gl.getUniformLocation(shader, "uEye");
                shader.u_lights = [];
                shader.u_numLights = gl.getUniformLocation(shader, "numLights");
                for (let i = 0; i < MAX_LIGHTS; i++) {
                    let light = {
                        pos: gl.getUniformLocation(shader, "lights["+i+"].pos"),
                        color: gl.getUniformLocation(shader, "lights["+i+"].color"),
                        atten: gl.getUniformLocation(shader, "lights["+i+"].atten")
                    };
                    shader.u_lights.push(light);
                }
                shader.u_boneTransforms = [];
                shader.u_boneNormalTransforms = [];
                shader.u_numBones = gl.getUniformLocation(shader, "numBones");
                for (let i = 0; i < MAX_BONES; i++) {
                    shader.u_boneTransforms.push(gl.getUniformLocation(shader, "boneTransforms["+i+"]"));
                    shader.u_boneNormalTransforms.push(gl.getUniformLocation(shader, "boneNormalTransforms["+i+"]"));
                }
                shader.shaderReady = true;
                that.shaders.skinShader = shader;
                resolve(shader);
            });
        });
    }


    /**
     * Redraw the mesh
     */
    repaint() {
        this.gl.viewport(0, 0, this.gl.viewportWidth, this.gl.viewportHeight);
        this.lights = [{pos:this.camera.pos, color:[1, 1, 1], atten:[1, 0, 0]}];

        //NOTE: Before this, the canvas has all options we need except
        //for "shaderToUse"
        let canvas = this;
        if (!('shaderReady' in this.shaders.skinShader)) {
            // Wait until the promise has resolved, then draw again
            this.shaders.skinShader.then(canvas.repaint.bind(canvas));
        }
        else {
            this.shaderToUse = this.shaders.skinShader;
            this.mesh.render(this);
        }
    }

    /**
     * Re-center the camera on the mesh
     */
    centerCamera() {
        this.camera.centerOnMesh(this.mesh);
    }
}
